import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenCipherService } from '../common/crypto/token-cipher.service';
import { ToolUpstream } from './entities/tool-upstream.entity';
import { CreateUpstreamDto, UpdateUpstreamDto, UpstreamResponse } from './dto/upstream.dto';

@Injectable()
export class ToolUpstreamsService {
  constructor(
    @InjectRepository(ToolUpstream) private readonly repo: Repository<ToolUpstream>,
    private readonly cipher: TokenCipherService,
  ) {}

  async create(dto: CreateUpstreamDto): Promise<UpstreamResponse> {
    const bearerCiphertext = this.cipher.encrypt(dto.bearer);
    const row = this.repo.create({
      name: dto.name,
      baseUrl: dto.baseUrl,
      bearerCiphertext,
      timeoutMs: dto.timeoutMs,
      enabled: dto.enabled,
    });
    const saved = await this.repo.save(row);
    return this.toResponse(saved);
  }

  async list(): Promise<UpstreamResponse[]> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return rows.map((r) => this.toResponse(r));
  }

  async get(id: string): Promise<UpstreamResponse> {
    const row = await this.findOrFail(id);
    return this.toResponse(row);
  }

  async update(id: string, dto: UpdateUpstreamDto): Promise<UpstreamResponse> {
    const row = await this.findOrFail(id);
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.baseUrl !== undefined) row.baseUrl = dto.baseUrl;
    if (dto.bearer !== undefined) row.bearerCiphertext = this.cipher.encrypt(dto.bearer);
    if (dto.timeoutMs !== undefined) row.timeoutMs = dto.timeoutMs;
    if (dto.enabled !== undefined) row.enabled = dto.enabled;
    row.updatedAt = new Date();
    const saved = await this.repo.save(row);
    return this.toResponse(saved);
  }

  // Soft-disable: sets enabled=false. Hard-delete blocked by FK from tool_bridges.
  async disable(id: string): Promise<void> {
    const row = await this.findOrFail(id);
    row.enabled = false;
    row.updatedAt = new Date();
    await this.repo.save(row);
  }

  // Internal-only: used by P3 dispatch layer to obtain plaintext bearer for HTTP call.
  async getDecryptedBearer(id: string): Promise<string> {
    const row = await this.findOrFail(id);
    return this.cipher.decrypt(row.bearerCiphertext);
  }

  private async findOrFail(id: string): Promise<ToolUpstream> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`tool_upstream ${id} not found`);
    return row;
  }

  private toResponse(row: ToolUpstream): UpstreamResponse {
    return {
      id: row.id,
      name: row.name,
      baseUrl: row.baseUrl,
      bearer: '***',
      timeoutMs: row.timeoutMs,
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
