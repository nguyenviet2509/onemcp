import { ForbiddenException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditLogService } from '../audit/audit-log.service';
import { MetricsService } from '../metrics/metrics.service';
import { redactArgs } from '../mcp/mcp-args-redactor';
import { McpToolResult } from '../mcp/mcp-jsonrpc.types';
import { RequestUser } from '../common/user-request';
import { ToolBridge } from './entities/tool-bridge.entity';
import { HttpProxyClient } from './http-proxy.client';
import { ToolUpstreamsService } from './tool-upstreams.service';
import { createBridgeMetrics, BridgeMetrics } from './bridge-metrics';
import { ParamSchemaValidator } from './param-schema.validator';

// Orchestrates bridge tool call lifecycle:
//   Path C guard → param validation → upstream fetch → audit → metrics → MCP result.
@Injectable()
export class BridgeDispatcherService implements OnModuleInit {
  private readonly log = new Logger(BridgeDispatcherService.name);
  private metrics!: BridgeMetrics;

  constructor(
    private readonly proxy: HttpProxyClient,
    private readonly upstreams: ToolUpstreamsService,
    private readonly audit: AuditLogService,
    private readonly metricsSvc: MetricsService,
    private readonly validator: ParamSchemaValidator,
  ) {}

  onModuleInit(): void {
    this.metrics = createBridgeMetrics(this.metricsSvc.registry);
  }

  async dispatch(
    bridge: ToolBridge,
    args: Record<string, unknown>,
    user: RequestUser,
    ip?: string,
  ): Promise<McpToolResult> {
    // Path C guard: bridge tools require Zitadel OAuth (need sub for downstream RBAC check).
    if (user.authPath === 'header' || !user.zitadelSub) {
      this.metrics.callsTotal.inc({ tool: bridge.name, upstream_status: 'n/a', outcome: 'path_c_block' });
      // Audit denial unconditionally — evidence must not disappear regardless of outer env flag.
      this.publishAudit(bridge.name, args, user, randomUUID(), 'denied', ip, 'path_c_no_oauth');
      throw new ForbiddenException('Bridge tools require OAuth authentication (Zitadel sub missing)');
    }

    const correlationId = randomUUID();
    const startMs = Date.now();

    // Validate required fields from param_schema.
    const schemaRequired = (bridge.paramSchema as { required?: string[] }).required ?? [];
    for (const field of schemaRequired) {
      if (!(field in args)) {
        this.metrics.callsTotal.inc({ tool: bridge.name, upstream_status: 'n/a', outcome: 'validation_error' });
        this.publishAudit(bridge.name, args, user, correlationId, 'validation_error', ip, `Missing required argument: ${field}`);
        return this.errorResult(`Missing required argument: ${field}`);
      }
    }
    // Structural schema meta-check (guards against corrupted DB entry — write-time validates too).
    try {
      this.validator.validate(bridge.paramSchema);
    } catch {
      // Log but don't abort — write-time validation already enforced structure.
      this.log.warn(`bridge=${bridge.name} param_schema meta-check failed (DB entry may be corrupted)`);
    }
    const toolLabel = bridge.name;

    try {
      const [bearer, upstreamEntity] = await Promise.all([
        this.upstreams.getDecryptedBearer(bridge.upstreamId),
        this.upstreams.getEntity(bridge.upstreamId),
      ]);

      const result = await this.proxy.call({
        bridge,
        upstream: upstreamEntity,
        bearer,
        args,
        username: user.username,
        zitadelSub: user.zitadelSub,
        correlationId,
      });

      const upstreamStatus = result.status === 0 ? 'timeout' : String(result.status);
      const outcome = result.status === 0 ? 'timeout'
        : result.status >= 500 ? 'error'
        : 'success';

      const latency = (Date.now() - startMs) / 1000;
      this.metrics.latencySeconds.observe({ tool: toolLabel }, latency);
      this.metrics.responseBytes.observe({ tool: toolLabel }, result.bytesRead);
      this.metrics.callsTotal.inc({ tool: toolLabel, upstream_status: upstreamStatus, outcome });
      if (result.truncated) {
        this.metrics.truncatedTotal.inc({ tool: toolLabel });
      }

      this.publishAudit(toolLabel, args, user, correlationId, upstreamStatus, ip);

      return {
        content: [{ type: 'text', text: result.body }],
        isError: result.status >= 400 || result.status === 0,
      };
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      const latency = (Date.now() - startMs) / 1000;
      this.metrics.latencySeconds.observe({ tool: toolLabel }, latency);
      this.metrics.callsTotal.inc({ tool: toolLabel, upstream_status: 'error', outcome: 'error' });
      const errMsg = `${(err as Error).name ?? 'Error'}: ${(err as Error).message?.slice(0, 500) ?? ''}`;
      this.publishAudit(toolLabel, args, user, correlationId, 'error', ip, errMsg);
      throw err;
    }
  }

  private publishAudit(
    toolName: string,
    args: Record<string, unknown>,
    user: RequestUser,
    correlationId: string,
    upstreamStatus: string,
    ip?: string,
    errorMsg?: string,
  ): void {
    try {
      const redacted = redactArgs(toolName, args);
      this.audit.record({
        actor: user,
        action: 'mcp.tool.call',
        resourceType: `tool:${toolName}`,
        before: {
          args: redacted.fields,
          args_hash: redacted.args_hash,
          user_sub: user.zitadelSub,
          correlation_id: correlationId,
        },
        after: { status: upstreamStatus, ...(errorMsg ? { error: errorMsg } : {}) },
        ip,
        sessionId: user.clientId ?? `bridge:${user.username}`,
      });
    } catch (err) {
      this.log.error(`audit publish failed tool=${toolName}: ${(err as Error).message}`);
    }
  }

  private errorResult(msg: string): McpToolResult {
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
}
