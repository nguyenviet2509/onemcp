import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthedRequest } from '../common/user-request';
import { Skill } from '../skills/entities/skill.entity';
import { SkillVersion } from '../skills/entities/skill-version.entity';
import { SkillsService } from '../skills/skills.service';
import { McpToolDefinition, McpToolResult } from './mcp-jsonrpc.types';

// MCP tools exposed to AI agents. Dept-scoped (từ req.user).
// Tool naming theo MCP convention: snake_case.
@Injectable()
export class McpToolsService {
  constructor(
    private readonly skills: SkillsService,
    @InjectRepository(SkillVersion) private readonly versions: Repository<SkillVersion>,
    @InjectRepository(Skill) private readonly skillsRepo: Repository<Skill>,
  ) {}

  definitions(): McpToolDefinition[] {
    return [
      {
        name: 'list_skills',
        description:
          'Liệt kê skills khả dụng trong department của user. Filter theo tag/query. Dùng để discover skill trước khi load.',
        inputSchema: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'Filter theo tag (optional)' },
            q: { type: 'string', description: 'Tìm theo name/description (optional)' },
          },
        },
      },
      {
        name: 'load_skill',
        description:
          'Tải nội dung SKILL.md của một skill (theo current active version). Trả về markdown content — inject vào context AI agent.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tên skill (unique per dept)' },
          },
          required: ['name'],
        },
      },
    ];
  }

  async call(name: string, args: Record<string, unknown>, req: AuthedRequest): Promise<McpToolResult> {
    if (!req.user) {
      return this.errorResult('unauthenticated — missing identity header');
    }
    switch (name) {
      case 'list_skills':
        return this.listSkills(args, req);
      case 'load_skill':
        return this.loadSkill(args, req);
      default:
        return this.errorResult(`unknown tool: ${name}`);
    }
  }

  private async listSkills(args: Record<string, unknown>, req: AuthedRequest): Promise<McpToolResult> {
    const tag = typeof args.tag === 'string' ? args.tag : undefined;
    const q = typeof args.q === 'string' ? args.q : undefined;
    const items = await this.skills.list(req.user!, { tag, q });
    const lines = items.map(
      (s) => `- ${s.name} — ${s.description ?? '(no description)'} [tags: ${s.tags.join(', ') || 'none'}]`,
    );
    const text = items.length === 0 ? 'No skills found.' : `Found ${items.length} skill(s):\n${lines.join('\n')}`;
    return { content: [{ type: 'text', text }] };
  }

  private async loadSkill(args: Record<string, unknown>, req: AuthedRequest): Promise<McpToolResult> {
    const name = String(args.name ?? '').trim();
    if (!name) return this.errorResult('name is required');

    const skill = await this.skillsRepo.findOne({
      where: { departmentId: req.user!.departmentId, name },
    });
    if (!skill) return this.errorResult(`skill "${name}" not found`);
    if (!skill.currentVersionId) {
      return this.errorResult(`skill "${name}" has no active version — chờ maintainer approve`);
    }

    const version = await this.versions.findOne({ where: { id: skill.currentVersionId } });
    if (!version) return this.errorResult(`current version ${skill.currentVersionId} missing`);

    // Log load event (audit + analytics).
    await this.skills.recordLoadEvent({
      skillId: skill.id,
      skillVersionId: version.id,
      user: req.user!,
      ip: req.clientIp,
    });

    const body = version.body ?? '(no body content — chưa sync từ git)';
    const header = `# Skill: ${skill.name}\nVersion: ${version.version ?? 'unknown'} (commit ${version.commitSha.slice(0, 8)})\n\n---\n\n`;
    return { content: [{ type: 'text', text: header + body }] };
  }

  private errorResult(msg: string): McpToolResult {
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
}
