// @ts-nocheck — SDK's registerTool has excessively deep generics that TypeScript
// on some environments (Alpine Docker) can't disambiguate; local dev/editor still
// give hints. Runtime behavior verified via integration tests.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ARTIFACT_TYPES } from '../artifacts/artifact-type.enum';
import { AuthedRequest } from '../common/user-request';
import { McpToolsService } from './mcp-tools.service';

// Factory that creates a per-request McpServer wired to existing McpToolsService methods.
// Stateful transport (one Server per session) — transport connects at request time.
// Uses SDK 1.30.0 `registerTool(name, config, cb)` API — unambiguous vs `tool()` overloads
// which failed to disambiguate on VPS TypeScript build.

@Injectable()
export class McpSdkServerFactory implements OnModuleInit {
  private readonly log = new Logger(McpSdkServerFactory.name);

  constructor(private readonly tools: McpToolsService) {}

  onModuleInit(): void {
    this.log.log('McpSdkServerFactory ready');
  }

  createServer(req: AuthedRequest): McpServer {
    const server = new McpServer({ name: 'onemcp', version: '0.1.0' });
    this.registerTools(server, req);
    return server;
  }

  private registerTools(server: McpServer, req: AuthedRequest): void {
    server.registerTool(
      'list_skills',
      {
        description: 'Liệt kê skills khả dụng. Filter tag/query. Gọi trước khi load_skill.',
        inputSchema: {
          tag: z.string().optional(),
          q: z.string().optional(),
        },
      },
      async ({ tag, q }) => this.tools.call('list_skills', { tag, q }, req) as never,
    );

    server.registerTool(
      'load_skill',
      {
        description: 'Tải SKILL.md content của skill (current active version). Inject vào agent context.',
        inputSchema: { name: z.string() },
      },
      async ({ name }) => this.tools.call('load_skill', { name }, req) as never,
    );

    server.registerTool(
      'list_artifacts',
      {
        description: 'Liệt kê artifacts (report/research/kb/postmortem/runbook) trong dept. Filter type/tag/query.',
        inputSchema: {
          type: z.enum(ARTIFACT_TYPES as [string, ...string[]]).optional(),
          tag: z.string().optional(),
          q: z.string().optional(),
        },
      },
      async ({ type, tag, q }) => this.tools.call('list_artifacts', { type, tag, q }, req) as never,
    );

    server.registerTool(
      'get_artifact',
      {
        description: 'Đọc artifact theo id (trả về body + metadata). Chỉ published visible cho non-owner.',
        inputSchema: { id: z.string() },
      },
      async ({ id }) => this.tools.call('get_artifact', { id }, req) as never,
    );

    server.registerTool(
      'get_artifact_template',
      {
        description: 'Trả về template (sections bắt buộc + optional) cho artifact type.',
        inputSchema: { type: z.enum(ARTIFACT_TYPES as [string, ...string[]]) },
      },
      async ({ type }) => this.tools.call('get_artifact_template', { type }, req) as never,
    );

    server.registerTool(
      'search',
      {
        description: 'Search full-text + semantic (hybrid) qua skills + artifacts trong dept.',
        inputSchema: {
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
      },
      async (args) => this.tools.call('search', args as Record<string, unknown>, req) as never,
    );

    server.registerTool(
      'submit_artifact',
      {
        description: 'Submit artifact mới (type: report|research|kb|postmortem|runbook). Trạng thái=pending.',
        inputSchema: {
          type: z.enum(ARTIFACT_TYPES as [string, ...string[]]).optional(),
          template_key: z.string().optional(),
          space: z.string().optional(),
          title: z.string(),
          slug: z.string(),
          body: z.string(),
          structured: z.record(z.unknown()).optional(),
          tags: z.array(z.string()).optional(),
        },
      },
      async (args) => this.tools.call('submit_artifact', args as Record<string, unknown>, req) as never,
    );

    server.registerTool(
      'load_runbook',
      {
        description: 'Tải runbook operational theo tên hoặc service. Ưu tiên gọi khi user mô tả sự cố production.',
        inputSchema: {
          name: z.string().optional(),
          service: z.string().optional(),
        },
      },
      async ({ name, service }) => this.tools.call('load_runbook', { name, service }, req) as never,
    );
  }
}
