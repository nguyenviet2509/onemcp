import { Body, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { AuthedRequest } from '../common/user-request';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  MCP_PROTOCOL_VERSION,
  RPC_INTERNAL_ERROR,
  RPC_INVALID_PARAMS,
  RPC_INVALID_REQUEST,
  RPC_METHOD_NOT_FOUND,
} from './mcp-jsonrpc.types';
import { McpToolsService } from './mcp-tools.service';

// MCP endpoint — JSON-RPC 2.0 over HTTP POST.
// Client (Claude Code) config:
//   { "type": "http", "url": "https://onemcp.local/api/mcp", "headers": { "X-Onemcp-User": "alice" } }
// Access: reuse IpCidrGuard (global) + TrustUserMiddleware — req.user set trước khi vào đây.
@Controller('mcp')
export class McpController {
  private readonly log = new Logger(McpController.name);

  constructor(private readonly tools: McpToolsService) {}

  @Post()
  @HttpCode(200)
  async handle(@Body() body: JsonRpcRequest, @Req() req: AuthedRequest): Promise<JsonRpcResponse> {
    const rid = body?.id ?? null;

    if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
      return this.error(rid, RPC_INVALID_REQUEST, 'Invalid JSON-RPC request');
    }

    try {
      switch (body.method) {
        case 'initialize':
          return this.ok(rid, {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: 'onemcp', version: '0.1.0' },
          });

        case 'ping':
          return this.ok(rid, {});

        case 'tools/list':
          return this.ok(rid, { tools: this.tools.definitions() });

        case 'tools/call': {
          const params = body.params ?? {};
          const name = typeof params.name === 'string' ? params.name : '';
          const args = (params.arguments as Record<string, unknown>) ?? {};
          if (!name) {
            return this.error(rid, RPC_INVALID_PARAMS, 'params.name required');
          }
          const result = await this.tools.call(name, args, req);
          return this.ok(rid, result);
        }

        case 'notifications/initialized':
        case 'notifications/cancelled':
          // Notifications không cần response (id absent) — nhưng nếu client gửi kèm id, ta ack empty.
          return this.ok(rid, {});

        default:
          return this.error(rid, RPC_METHOD_NOT_FOUND, `method not found: ${body.method}`);
      }
    } catch (e) {
      const msg = (e as Error).message;
      this.log.error(`mcp method=${body.method} error: ${msg}`);
      return this.error(rid, RPC_INTERNAL_ERROR, msg);
    }
  }

  private ok(id: string | number | null, result: unknown): JsonRpcResponse {
    return { jsonrpc: '2.0', id, result };
  }

  private error(id: string | number | null, code: number, message: string): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }
}
