import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolBridge } from './entities/tool-bridge.entity';
import { ToolUpstreamsService } from './tool-upstreams.service';
import { CreateBridgeDto, UpdateBridgeDto, BridgeResponse } from './dto/bridge.dto';
import { ParamSchemaValidator } from './param-schema.validator';

export interface DryRunResult {
  schema_valid: boolean;
  errors: string[] | null;
  resolved_url: string;
  would_send_headers: Record<string, string>;
}

@Injectable()
export class ToolBridgesService {
  constructor(
    @InjectRepository(ToolBridge) private readonly repo: Repository<ToolBridge>,
    private readonly paramSchemaValidator: ParamSchemaValidator,
    private readonly upstreamsSvc: ToolUpstreamsService,
  ) {}

  async create(dto: CreateBridgeDto): Promise<BridgeResponse> {
    this.paramSchemaValidator.validate(dto.paramSchema);
    const row = this.repo.create({
      upstreamId: dto.upstreamId,
      name: dto.name,
      description: dto.description,
      method: dto.method,
      path: dto.path,
      paramSchema: dto.paramSchema,
      permissionId: dto.permissionId,
      enabled: dto.enabled,
    });
    const saved = await this.repo.save(row);
    return this.toResponse(saved);
  }

  async list(): Promise<BridgeResponse[]> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return rows.map((r) => this.toResponse(r));
  }

  async get(id: string): Promise<BridgeResponse> {
    const row = await this.findOrFail(id);
    return this.toResponse(row);
  }

  async update(id: string, dto: UpdateBridgeDto): Promise<BridgeResponse> {
    const row = await this.findOrFail(id);
    if (dto.upstreamId !== undefined) row.upstreamId = dto.upstreamId;
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.method !== undefined) row.method = dto.method;
    if (dto.path !== undefined) row.path = dto.path;
    if (dto.paramSchema !== undefined) {
      this.paramSchemaValidator.validate(dto.paramSchema);
      row.paramSchema = dto.paramSchema;
    }
    if (dto.permissionId !== undefined) row.permissionId = dto.permissionId;
    if (dto.enabled !== undefined) row.enabled = dto.enabled;
    row.updatedAt = new Date();
    const saved = await this.repo.save(row);
    return this.toResponse(saved);
  }

  // Soft-disable: sets enabled=false. Preserves audit history.
  async disable(id: string): Promise<void> {
    const row = await this.findOrFail(id);
    row.enabled = false;
    row.updatedAt = new Date();
    await this.repo.save(row);
  }

  // Dry-run: validate args vs param_schema + resolve URL preview. NEVER fetches upstream.
  async dryRunTest(id: string, args: unknown): Promise<DryRunResult> {
    const bridge = await this.findOrFail(id);
    const upstream = await this.upstreamsSvc.get(bridge.upstreamId);

    // Validate args against bridge param_schema using structural check (same approach as ParamSchemaValidator).
    // Full ajv not in deps — validate required fields and type hints structurally.
    const schema = bridge.paramSchema as {
      properties?: Record<string, { type?: string }>;
      required?: string[];
    };
    const errors: string[] = [];

    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      errors.push('args must be a JSON object');
    } else {
      const argsObj = args as Record<string, unknown>;
      if (schema.required) {
        for (const req of schema.required) {
          if (!(req in argsObj)) errors.push(`Missing required field: ${req}`);
        }
      }
      if (schema.properties) {
        for (const [key, propDef] of Object.entries(schema.properties)) {
          if (!(key in argsObj)) continue;
          const val = argsObj[key];
          if (propDef.type) {
            const actual = Array.isArray(val) ? 'array' : typeof val;
            const expected = propDef.type === 'integer' ? 'number' : propDef.type;
            if (actual !== expected) errors.push(`Field "${key}": expected ${propDef.type}, got ${actual}`);
          }
        }
      }
    }

    // Build resolved URL preview — substitute :param placeholders from args.
    let resolvedPath = bridge.path;
    if (errors.length === 0 && typeof args === 'object' && args !== null) {
      const argsObj = args as Record<string, unknown>;
      resolvedPath = resolvedPath.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name: string) =>
        name in argsObj ? encodeURIComponent(String(argsObj[name])) : `:${name}`,
      );
    }
    const resolvedUrl = `${upstream.baseUrl.replace(/\/$/, '')}${resolvedPath}`;

    return {
      schema_valid: errors.length === 0,
      errors: errors.length > 0 ? errors : null,
      resolved_url: resolvedUrl,
      would_send_headers: {
        'Authorization': 'Bearer ***',
        'User-Agent': 'OneMCP-ToolBridge/1.0',
        'X-Correlation-Id': '<generated-per-request>',
        'Content-Type': bridge.method !== 'GET' ? 'application/json' : '<not-sent>',
      },
    };
  }

  // P3 dispatch: list all enabled bridges for tools/list merge.
  async listEnabled(): Promise<ToolBridge[]> {
    return this.repo.find({ where: { enabled: true }, order: { createdAt: 'ASC' } });
  }

  // Used by P2 RBAC guard / P3 dispatch to lookup bridge by name.
  async findByName(name: string): Promise<ToolBridge | null> {
    return this.repo.findOne({ where: { name, enabled: true } });
  }

  private async findOrFail(id: string): Promise<ToolBridge> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`tool_bridge ${id} not found`);
    return row;
  }

  private toResponse(row: ToolBridge): BridgeResponse {
    return {
      id: row.id,
      upstreamId: row.upstreamId,
      name: row.name,
      description: row.description,
      method: row.method,
      path: row.path,
      paramSchema: row.paramSchema,
      permissionId: row.permissionId,
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
