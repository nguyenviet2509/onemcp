import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ARTIFACT_TYPES, ArtifactType } from '../artifacts/artifact-type.enum';
import { ArtifactsService } from '../artifacts/artifacts.service';
import { sanitizeRunbookOutput } from '../artifacts/runbook-sanitize.util';
import { getTemplate } from '../artifacts/templates/template-registry';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthedRequest } from '../common/user-request';
import { MetricsService } from '../metrics/metrics.service';
import { SearchService } from '../search/search.service';
import { Skill } from '../skills/entities/skill.entity';
import { SkillVersion } from '../skills/entities/skill-version.entity';
import { SkillsService } from '../skills/skills.service';
import { SpacesService } from '../spaces/spaces.service';
import { TemplatesService } from '../templates/templates.service';
import { initHashSecret, redactArgs, sanitizeForLog } from './mcp-args-redactor';
import { McpToolDefinition, McpToolResult } from './mcp-jsonrpc.types';
import { handleSearchTool } from './tools/search-tool-handler';
import { handleSubmitArtifactTool } from './tools/submit-artifact-tool-handler';

// MCP tools exposed to AI agents. Dept-scoped (từ req.user).
// Tool naming theo MCP convention: snake_case.
@Injectable()
export class McpToolsService implements OnModuleInit {
  private readonly log = new Logger(McpToolsService.name);
  private auditEnabled = false;

  constructor(
    private readonly skills: SkillsService,
    private readonly artifacts: ArtifactsService,
    private readonly searchSvc: SearchService,
    private readonly spacesService: SpacesService,
    private readonly templatesService: TemplatesService,
    @InjectRepository(SkillVersion) private readonly versions: Repository<SkillVersion>,
    @InjectRepository(Skill) private readonly skillsRepo: Repository<Skill>,
    private readonly audit: AuditLogService,
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.auditEnabled =
      (this.config.get<string>('MCP_TOOL_AUDIT_ENABLED', 'false') || 'false').toLowerCase() ===
      'true';
    if (this.auditEnabled) {
      // F6: HMAC secret required only when audit is on. Fail-fast at boot if missing/short.
      const secret = this.config.get<string>('MCP_AUDIT_HASH_SECRET', '') || '';
      initHashSecret(secret);
      this.log.log(`MCP tool audit ENABLED (HMAC hash active)`);
    }
  }

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
        description: 'Liệt kê artifacts (report/research/kb/postmortem/runbook) trong dept. Filter type/tag/query.',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: [...ARTIFACT_TYPES] },
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
            type: { type: 'string', enum: [...ARTIFACT_TYPES] },
          },
          required: ['type'],
        },
      },
      {
        name: 'search',
        description:
          'Search full-text + semantic (hybrid) qua skills + artifacts trong dept. Dùng khi cần tìm KB đã có cho vấn đề tương tự (bug trace, previous fix, existing report). Truyền service để boost runbook + artifacts. Truyền mode=semantic để tìm theo nghĩa dù khác từ khoá.',
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Query text — bỏ dấu OK (unaccent auto)' },
            kind: { type: 'string', enum: ['all', 'skill', 'artifact'], description: 'Filter loại (chỉ áp dụng khi không dùng mode)' },
            limit: { type: 'number', description: 'Max results (default 20, max 100)' },
            service: {
              type: 'string',
              description: 'Tên service để boost ranking. Nếu không pass, server tự detect từ query text.',
            },
            // Phase 2C: hybrid search optional params — backward compat (old callers omit these).
            mode: {
              type: 'string',
              enum: ['hybrid', 'fts', 'semantic'],
              description: 'Search mode: hybrid (default, FTS+vector+RRF), fts (keyword only), semantic (vector only).',
            },
            space: {
              type: 'string',
              description: 'Space slug để filter kết quả trong một space cụ thể.',
            },
            template_key: {
              type: 'string',
              description: 'Template key để filter theo loại artifact (kb, report, sop, ...).',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter artifacts có ít nhất một trong các tag này.',
            },
            dept: {
              type: 'string',
              description: 'Department slug (reserved — hiện tại search trong dept của caller).',
            },
          },
          required: ['q'],
        },
      },
      {
        name: 'submit_artifact',
        description:
          'Submit artifact mới (type: report|research|kb|postmortem|runbook). Trạng thái=pending chờ maintainer approve. Dùng cuối session để nộp report/KB. Phase 1C: hỗ trợ template_key + space slug.',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: [...ARTIFACT_TYPES], description: 'Deprecated — dùng template_key thay thế' },
            template_key: { type: 'string', description: 'Template key từ registry DB (vd: kb, report, sop)' },
            space: { type: 'string', description: 'Space slug artifact thuộc về (optional)' },
            title: { type: 'string' },
            slug: { type: 'string', description: 'URL-friendly, unique per dept' },
            body: { type: 'string', description: 'Markdown content' },
            structured: { type: 'object' },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'slug', 'body'],
        },
      },
      {
        name: 'load_runbook',
        description:
          'Tải runbook operational theo tên hoặc service. Ưu tiên gọi khi user mô tả sự cố production.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Slug hoặc title của runbook cụ thể' },
            service: { type: 'string', description: 'Tên service để list runbooks liên quan (khi chưa biết runbook nào)' },
          },
        },
      },
    ];
  }

  async call(name: string, args: Record<string, unknown>, req: AuthedRequest): Promise<McpToolResult> {
    if (!req.user) return this.errorResult('unauthenticated — missing identity header');
    if (!this.auditEnabled) {
      return this.dispatch(name, args, req);
    }

    // Audit-wrapped path — record per-call metadata for compliance/abuse/debug.
    // Redacted args + duration + status stored to audit_events (Phase 03/04).
    const startedAt = Date.now();
    const safeName = sanitizeForLog(name, 64); // F14: strip control chars from user input
    const redacted = redactArgs(name, args);
    let result: McpToolResult | undefined;
    let status: 'ok' | 'error' = 'ok';
    let errorMsg: string | undefined;
    try {
      result = await this.dispatch(name, args, req);
      if (result?.isError) {
        status = 'error';
        errorMsg = sanitizeForLog(extractErrorText(result), 200);
      }
    } catch (err: unknown) {
      status = 'error';
      errorMsg = sanitizeForLog(err instanceof Error ? err.message : String(err), 200);
      throw err; // Rethrow — audit is side-effect, never swallow tool errors
    } finally {
      const durationMs = Date.now() - startedAt;
      try {
        // F11: wrap in try/catch — audit bug must NOT crash tool call path
        this.audit.record({
          actor: req.user,
          action: 'mcp.tool.call',
          resourceType: `tool:${safeName}`,
          resourceId: extractResourceId(name, args),
          before: { args: redacted.fields, args_hash: redacted.args_hash },
          after: {
            status,
            duration_ms: durationMs,
            error: errorMsg,
            result_count: result ? extractResultCount(result) : undefined,
          },
          ip: req.clientIp,
          // A8: fallback to portal:{username} for trust-header path where clientId is undefined
          sessionId: req.user.clientId ?? `portal:${req.user.username}`,
        });
        this.metrics.auditWritten.inc({ tool: safeName, status });
      } catch (auditErr) {
        this.log.error(
          `audit_record_threw tool=${safeName}: ${sanitizeForLog(String(auditErr), 200)}`,
        );
        this.metrics.auditWriteFailures.inc({ tool: safeName, status });
      }
    }
    return result ?? this.errorResult('unknown dispatch failure');
  }

  private dispatch(name: string, args: Record<string, unknown>, req: AuthedRequest): Promise<McpToolResult> {
    switch (name) {
      case 'list_skills':           return this.listSkills(args, req);
      case 'load_skill':            return this.loadSkill(args, req);
      case 'list_artifacts':        return this.listArtifacts(args, req);
      case 'get_artifact':          return this.getArtifact(args, req);
      case 'get_artifact_template': return Promise.resolve(this.getTemplateTool(args));
      case 'search':                return handleSearchTool(args, req, this.searchSvc, this.spacesService);
      case 'submit_artifact':       return handleSubmitArtifactTool(args, req, this.artifacts, this.spacesService, this.templatesService);
      case 'load_runbook':          return this.loadRunbookTool(args, req);
      default:                      return Promise.resolve(this.errorResult(`unknown tool: ${name}`));
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

  // load_runbook — dedicated tool cho agent prioritize khi paged (RT-11: sanitize output).
  private async loadRunbookTool(args: Record<string, unknown>, req: AuthedRequest): Promise<McpToolResult> {
    const name = typeof args.name === 'string' ? args.name.trim() : undefined;
    const service = typeof args.service === 'string' ? args.service.trim() : undefined;

    if (!name && !service) {
      return this.errorResult('load_runbook requires name or service');
    }

    try {
      const result = await this.artifacts.loadRunbook(req.user!, { name, service }, req.clientIp);

      if (result.kind === 'not_found') {
        const what = name ? `name="${name}"` : `service="${service}"`;
        return this.errorResult(`Không tìm thấy runbook với ${what}`);
      }

      if (result.kind === 'list') {
        if (result.items.length === 0) {
          return { content: [{ type: 'text', text: `Không có runbook nào cho service "${service}".` }] };
        }
        const lines = result.items.map(
          (a) => `- ${a.slug} — ${a.title} [service: ${a.service ?? '-'}]`,
        );
        return {
          content: [{
            type: 'text',
            text: `Runbooks cho service "${service}" (${result.items.length} kết quả):\n${lines.join('\n')}\n\nGọi load_runbook với name=<slug> để tải nội dung cụ thể.`,
          }],
        };
      }

      // kind === 'single' — trả về body đã sanitize (RT-11).
      const { artifact, version } = result;
      const sanitizedBody = sanitizeRunbookOutput(result.body);
      const header = [
        `# Runbook: ${artifact.title}`,
        `Service: ${artifact.service ?? '-'} · v${version.versionNo} · status=${artifact.status}`,
        `Tags: ${artifact.tags.join(', ') || 'none'}`,
        '',
        '---',
        '',
      ].join('\n');

      return { content: [{ type: 'text', text: header + sanitizedBody }] };
    } catch (e) {
      return this.errorResult((e as Error).message);
    }
  }

  private errorResult(msg: string): McpToolResult {
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
}

// --- Audit helpers (module-scoped, no state) ---

// Extract resource id from args when tool identifies a single target.
function extractResourceId(name: string, args: Record<string, unknown>): string | undefined {
  if (name === 'get_artifact' && args.id != null) return String(args.id);
  if (name === 'load_skill' && typeof args.name === 'string') return args.name;
  if (name === 'load_runbook' && typeof args.name === 'string') return args.name;
  return undefined;
}

// Parse "Found N ..." pattern from list-style tool results for audit summary.
function extractResultCount(result: McpToolResult): number | undefined {
  const first = result.content?.[0];
  const text = first && first.type === 'text' ? first.text : '';
  const m = text.match(/^Found (\d+)/);
  return m ? Number(m[1]) : undefined;
}

// Extract text from first content block for error message capture.
function extractErrorText(result: McpToolResult): string {
  const first = result.content?.[0];
  return first && first.type === 'text' ? first.text : 'unknown error';
}
