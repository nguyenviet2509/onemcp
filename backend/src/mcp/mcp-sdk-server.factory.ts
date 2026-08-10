import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ARTIFACT_TYPES } from '../artifacts/artifact-type.enum';
import { AuthedRequest } from '../common/user-request';
import { McpToolsService } from './mcp-tools.service';

// Factory that creates a per-request McpServer wired to existing McpToolsService methods.
// Stateful transport (one Server per session) — transport connects at request time.
// Tool schemas mirror mcp-tools.service definitions() but use Zod (SDK requirement).

@Injectable()
export class McpSdkServerFactory implements OnModuleInit {
  private readonly log = new Logger(McpSdkServerFactory.name);

  constructor(private readonly tools: McpToolsService) {}

  onModuleInit(): void {
    this.log.log('McpSdkServerFactory ready');
  }

  // Create a fresh McpServer bound to the given request's identity context.
  // Called once per initialize request; the same server instance handles the session.
  createServer(req: AuthedRequest): McpServer {
    const server = new McpServer({
      name: 'onemcp',
      version: '0.1.0',
    });

    this.registerTools(server, req);
    return server;
  }

  private registerTools(server: McpServer, req: AuthedRequest): void {
    // list_skills
    server.tool(
      'list_skills',
      'Liệt kê skills khả dụng. Filter tag/query. Gọi trước khi load_skill.',
      {
        tag: z.string().optional(),
        q: z.string().optional(),
      },
      async ({ tag, q }) => {
        const result = await this.tools.call('list_skills', { tag, q }, req);
        return result;
      },
    );

    // load_skill
    server.tool(
      'load_skill',
      'Tải SKILL.md content của skill (current active version). Inject vào agent context.',
      { name: z.string() },
      async ({ name }) => {
        const result = await this.tools.call('load_skill', { name }, req);
        return result;
      },
    );

    // list_artifacts
    server.tool(
      'list_artifacts',
      'Liệt kê artifacts (report/research/kb/postmortem/runbook) trong dept. Filter type/tag/query.',
      {
        type: z.enum(ARTIFACT_TYPES as [string, ...string[]]).optional(),
        tag: z.string().optional(),
        q: z.string().optional(),
      },
      async ({ type, tag, q }) => {
        const result = await this.tools.call('list_artifacts', { type, tag, q }, req);
        return result;
      },
    );

    // get_artifact
    server.tool(
      'get_artifact',
      'Đọc artifact theo id (trả về body + metadata). Chỉ published visible cho non-owner.',
      { id: z.string() },
      async ({ id }) => {
        const result = await this.tools.call('get_artifact', { id }, req);
        return result;
      },
    );

    // get_artifact_template
    server.tool(
      'get_artifact_template',
      'Trả về template (sections bắt buộc + optional) cho artifact type.',
      { type: z.enum(ARTIFACT_TYPES as [string, ...string[]]) },
      async ({ type }) => {
        const result = await this.tools.call('get_artifact_template', { type }, req);
        return result;
      },
    );

    // search
    server.tool(
      'search',
      'Search full-text + semantic (hybrid) qua skills + artifacts trong dept.',
      {
        q: z.string(),
        kind: z.enum(['all', 'skill', 'artifact']).optional(),
        limit: z.number().optional(),
        service: z.string().optional(),
        mode: z.enum(['hybrid', 'fts', 'semantic']).optional(),
        space: z.string().optional(),
        template_key: z.string().optional(),
        tags: z.array(z.string()).optional(),
        dept: z.string().optional(),
      },
      async (args) => {
        const result = await this.tools.call('search', args as Record<string, unknown>, req);
        return result;
      },
    );

    // submit_artifact
    server.tool(
      'submit_artifact',
      'Submit artifact mới (type: report|research|kb|postmortem|runbook). Trạng thái=pending.',
      {
        type: z.enum(ARTIFACT_TYPES as [string, ...string[]]).optional(),
        template_key: z.string().optional(),
        space: z.string().optional(),
        title: z.string(),
        slug: z.string(),
        body: z.string(),
        structured: z.record(z.unknown()).optional(),
        tags: z.array(z.string()).optional(),
      },
      async (args) => {
        const result = await this.tools.call('submit_artifact', args as Record<string, unknown>, req);
        return result;
      },
    );

    // load_runbook
    server.tool(
      'load_runbook',
      'Tải runbook operational theo tên hoặc service. Ưu tiên gọi khi user mô tả sự cố production.',
      {
        name: z.string().optional(),
        service: z.string().optional(),
      },
      async ({ name, service }) => {
        const result = await this.tools.call('load_runbook', { name, service }, req);
        return result;
      },
    );
  }
}
