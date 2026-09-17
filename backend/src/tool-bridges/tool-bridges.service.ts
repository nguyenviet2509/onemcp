import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolBridge } from './entities/tool-bridge.entity';
import { CreateBridgeDto, UpdateBridgeDto, BridgeResponse } from './dto/bridge.dto';
import { ParamSchemaValidator } from './param-schema.validator';

@Injectable()
export class ToolBridgesService {
  constructor(
    @InjectRepository(ToolBridge) private readonly repo: Repository<ToolBridge>,
    private readonly paramSchemaValidator: ParamSchemaValidator,
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

  // Used by P2 RBAC guard to lookup permission_id for a bridge by name.
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
