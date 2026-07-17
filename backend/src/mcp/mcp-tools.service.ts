import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ARTIFACT_TYPES, ArtifactType } from '../artifacts/artifact-type.enum';
import { ArtifactsService } from '../artifacts/artifacts.service';
import { submitArtifactSchema } from '../artifacts/dto/submit-artifact.dto';
import { getTemplate, listTemplates } from '../artifacts/templates/template-registry';
import { AuthedRequest } from '../common/user-request';
import { SearchEntityKind, SearchService } from '../search/search.service';
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
    private readonly artifacts: ArtifactsService,
    private readonly searchSvc: SearchService,
    @InjectRepository(SkillVersion) private readonly versions: Repository<SkillVersion>,
    @InjectRepository(Skill) private readonly skillsRepo: Repository<Skill>,
  ) {}

  definitions(): McpToolDefinition[] {
    return [
      {
        name: 'list_skills',
        description: 'Liệt kê skills khả dụng. Filter tag/query. Gọi trước khi load_skill.',
        inputSchema: {
          type: 'object',
          properties: {
            tag: { type: 'string' },
            q: { type: 'string' },
          },
        },
      },
      {
        name: 'load_skill',
        description: 'Tải SKILL.md content của skill (current active version). Inject vào agent context.',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      },
      {
        name: 'list_artifacts',
        description: 'Liệt kê artifacts (report/research/kb) trong dept. Filter type/tag/query.',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['report', 'research', 'kb'] },
            tag: { type: 'string' },
            q: { type: 'string' },
          },
        },
      },
      {
        name: 'get_artifact',
        description: 'Đọc artifact theo id (trả về body + metadata). Chỉ published visible cho non-owner.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
      {
        name: 'get_artifact_template',
        description:
          'Trả về template (sections bắt buộc + optional) cho artifact type. Gọi TRƯỚC submit_artifact để biết cấu trúc mong đợi (avoid validation reject).',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['report', 'research', 'kb'] },
          },
          required: ['type'],
        },
      },
      {
        name: 'search',
        description:
          'Search full-text (keyword + fuzzy) qua skills + artifacts trong dept. Dùng khi cần tìm KB đã có cho vấn đề tương tự (bug trace, previous fix, existing report).',
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Query text — bỏ dấu OK (unaccent auto)' },
            kind: { type: 'string', enum: ['all', 'skill', 'artifact'], description: 'Filter loại' },
            limit: { type: 'number', description: 'Max results (default 20, max 50)' },
          },
          required: ['q'],
        },
      },
      {
        name: 'submit_artifact',
        description:
          'Submit artifact mới (type: report|research|kb). Trạng thái=pending chờ maintainer approve. Dùng cuối session để nộp report/KB.',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['report', 'research', 'kb'] },
            title: { type: 'string' },
            slug: { type: 'string', description: 'URL-friendly, unique per dept' },
            body: { type: 'string', description: 'Markdown content' },
            structured: { type: 'object' },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['type', 'title', 'slug', 'body'],
        },
      },
    ];
  }

  async call(name: string, args: Record<string, unknown>, req: AuthedRequest): Promise<McpToolResult> {
    if (!req.user) return this.errorResult('unauthenticated — missing identity header');
    switch (name) {
      case 'list_skills':
        return this.listSkills(args, req);
      case 'load_skill':
        return this.loadSkill(args, req);
      case 'list_artifacts':
        return this.listArtifacts(args, req);
      case 'get_artifact':
        return this.getArtifact(args, req);
      case 'submit_artifact':
        return this.submitArtifact(args, req);
      case 'search':
        return this.doSearch(args, req);
      case 'get_artifact_template':
        return this.getTemplateTool(args);
      default:
        return this.errorResult(`unknown tool: ${name}`);
    }
  }

  private getTemplateTool(args: Record<string, unknown>): McpToolResult {
    const type = String(args.type ?? '').trim() as ArtifactType;
    if (!ARTIFACT_TYPES.includes(type)) {
      return this.errorResult(`type must be one of ${ARTIFACT_TYPES.join(', ')}`);
    }
    const t = getTemplate(type);
    const lines = [
      `Template: ${t.type} v${t.version}`,
      t.description,
      '',
      'Fields (JSON structured payload keys):',
      ...t.fields.map(
        (f) =>
          `- ${f.key} (${f.type}${f.required ? ', REQUIRED' : ', optional'}${f.minLength ? `, min=${f.minLength}` : ''}): ${f.label}${f.placeholder ? ` — e.g. ${f.placeholder.split('\n')[0]}` : ''}`,
      ),
      '',
      'Usage: submit_artifact với structured = { "field_key": "markdown text", ... }',
    ];
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  private async doSearch(args: Record<string, unknown>, req: AuthedRequest): Promise<McpToolResult> {
    const q = String(args.q ?? '').trim();
    if (!q) return this.errorResult('q is required');
    const kind = (args.kind as SearchEntityKind | 'all' | undefined) ?? 'all';
    const limit = typeof args.limit === 'number' ? args.limit : undefined;
    const hits = await this.searchSvc.search(req.user!, { q, kind, limit });
    if (hits.length === 0) return { content: [{ type: 'text', text: `No results for "${q}"` }] };
    const lines = hits.map((h, i) => {
      const idPart = h.kind === 'skill' ? h.name : `#${h.id}`;
      return `${i + 1}. [${h.kind}] ${idPart} — ${h.name}\n   snippet: ${h.snippet.slice(0, 200)}\n   tags: ${h.tags.join(', ') || '-'} · rank=${h.rank.toFixed(3)}`;
    });
    return { content: [{ type: 'text', text: `Found ${hits.length} result(s) for "${q}":\n\n${lines.join('\n\n')}` }] };
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
    if (!skill.currentVersionId) return this.errorResult(`skill "${name}" chưa có active version`);

    const version = await this.versions.findOne({ where: { id: skill.currentVersionId } });
    if (!version) return this.errorResult(`current version ${skill.currentVersionId} missing`);

    await this.skills.recordLoadEvent({
      skillName: skill.name,
      skillId: skill.id,
      skillVersionId: version.id,
      user: req.user!,
      ip: req.clientIp,
    });

    const body = version.body ?? '(no body content — chưa sync từ git)';
    const header = `# Skill: ${skill.name}\nVersion: ${version.version ?? 'unknown'} (commit ${version.commitSha.slice(0, 8)})\n\n---\n\n`;
    return { content: [{ type: 'text', text: header + body }] };
  }

  private async listArtifacts(args: Record<string, unknown>, req: AuthedRequest): Promise<McpToolResult> {
    const items = await this.artifacts.list(req.user!, {
      type: typeof args.type === 'string' ? (args.type as ArtifactType) : undefined,
      tag: typeof args.tag === 'string' ? args.tag : undefined,
      q: typeof args.q === 'string' ? args.q : undefined,
    });
    if (items.length === 0) return { content: [{ type: 'text', text: 'No artifacts found.' }] };
    const lines = items.map(
      (a) =>
        `- #${a.id} [${a.type}] ${a.title} — status=${a.status}, slug=${a.slug}, tags=${a.tags.join(',') || '-'}`,
    );
    return { content: [{ type: 'text', text: `Found ${items.length} artifact(s):\n${lines.join('\n')}` }] };
  }

  private async getArtifact(args: Record<string, unknown>, req: AuthedRequest): Promise<McpToolResult> {
    const id = String(args.id ?? '').trim();
    if (!id) return this.errorResult('id is required');
    try {
      const { artifact, version } = await this.artifacts.findOne(req.user!, id);
      if (!version) return this.errorResult('artifact chưa có version nào');
      const header = `# ${artifact.title}\nType: ${artifact.type} · Status: ${artifact.status} · v${version.versionNo}\nTags: ${artifact.tags.join(', ') || 'none'}\n\n---\n\n`;
      return { content: [{ type: 'text', text: header + version.body }] };
    } catch (e) {
      return this.errorResult((e as Error).message);
    }
  }

  private async submitArtifact(args: Record<string, unknown>, req: AuthedRequest): Promise<McpToolResult> {
    const parsed = submitArtifactSchema.safeParse(args);
    if (!parsed.success) {
      return this.errorResult(
        `invalid payload: ${parsed.error.errors.map((e) => `${e.path.join('.')}:${e.message}`).join(', ')}`,
      );
    }
    try {
      const { artifact, version } = await this.artifacts.create(req.user!, parsed.data);
      return {
        content: [
          {
            type: 'text',
            text: `Submitted artifact #${artifact.id} "${artifact.title}" (v${version.versionNo}, status=pending). Maintainer sẽ review.`,
          },
        ],
      };
    } catch (e) {
      return this.errorResult((e as Error).message);
    }
  }

  private errorResult(msg: string): McpToolResult {
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
}
