import { Controller, Get, Header } from '@nestjs/common';
import type { Response } from 'express';
import { Res } from '@nestjs/common';

/**
 * RBAC permission manifest for Central RBAC self-registration.
 * Contract: docs/central-rbac/manifest-schema (onelog central-rbac /.well-known/rbac-permissions-schema.json).
 *
 * Central RBAC admin syncs this file via wizard "Sync" button → diff review → apply.
 * When adding/removing permissions in OneMCP, update the PERMISSIONS array + bump version.
 * Slug must equal Central RBAC app.slug for OneMCP (namespace ownership Fix #13).
 */
@Controller('.well-known')
export class RbacManifestController {
  @Get('rbac-permissions.json')
  @Header('Cache-Control', 'public, max-age=300')
  @Header('Content-Type', 'application/json; charset=utf-8')
  async serveManifest(@Res({ passthrough: true }) res: Response) {
    // ETag = version — bump when permissions change so central-rbac sees non-304
    const etag = `"${manifest.version}"`;
    res.setHeader('ETag', etag);
    return manifest;
  }
}

// Kept inline to avoid indirection; ≤80 lines, easy to review by app maintainers.
const manifest = {
  schema: '1',
  service: 'onemcp',
  version: '2026.08.27',
  permissions: [
    // Knowledge Base
    { id: 'onemcp:kb.read', description: 'Đọc knowledge base (search, browse, view spaces + artifacts)' },
    { id: 'onemcp:kb.write', description: 'Tạo/sửa knowledge base artifacts + spaces' },
    { id: 'onemcp:kb.delete', description: 'Xoá artifacts + spaces (soft-delete)' },
    // MCP servers
    { id: 'onemcp:mcp.list', description: 'Xem danh sách MCP servers đã đăng ký' },
    { id: 'onemcp:mcp.register', description: 'Đăng ký MCP server mới (submit config, chờ approval)' },
    { id: 'onemcp:mcp.approve', description: 'Approve/reject MCP server registrations' },
    { id: 'onemcp:mcp.invoke', description: 'Gọi tools trên MCP servers đã approved' },
    // Skills
    { id: 'onemcp:skills.list', description: 'Xem danh sách skills' },
    { id: 'onemcp:skills.submit', description: 'Submit skill mới cho review' },
    { id: 'onemcp:skills.approve', description: 'Approve/reject skill submissions' },
    { id: 'onemcp:skills.invoke', description: 'Invoke skill via MCP' },
    // Departments + spaces access
    { id: 'onemcp:departments.manage', description: 'Tạo/sửa departments (org structure)' },
    { id: 'onemcp:spaces.manage', description: 'Tạo/sửa spaces + phân quyền space membership' },
    { id: 'onemcp:spaces.grant', description: 'Grant space access cho user/department' },
    // Attachments + storage
    { id: 'onemcp:attachments.upload', description: 'Upload file attachments vào MinIO' },
    { id: 'onemcp:attachments.download', description: 'Download attachments (subject to space ACL)' },
    // API keys + audit
    { id: 'onemcp:apikeys.manage', description: 'Tạo/rotate/revoke API keys của bản thân' },
    { id: 'onemcp:audit.read', description: 'Đọc audit log (limited to own actions unless admin)' },
    { id: 'onemcp:audit.read_all', description: 'Đọc toàn bộ audit log của org' },
    // Admin
    { id: 'onemcp:admin.settings', description: 'Sửa OneMCP global settings' },
    { id: 'onemcp:admin.users', description: 'Quản lý users + role assignments trong OneMCP scope' },
  ],
  default_roles: [
    {
      key: 'onemcp.viewer',
      description: 'Read-only across KB, MCP list, skills',
      permissions: ['onemcp:kb.read', 'onemcp:mcp.list', 'onemcp:skills.list', 'onemcp:attachments.download'],
    },
    {
      key: 'onemcp.editor',
      description: 'Write access to KB + attachments + submit skills',
      permissions: [
        'onemcp:kb.read',
        'onemcp:kb.write',
        'onemcp:mcp.list',
        'onemcp:mcp.invoke',
        'onemcp:skills.list',
        'onemcp:skills.submit',
        'onemcp:skills.invoke',
        'onemcp:attachments.upload',
        'onemcp:attachments.download',
        'onemcp:apikeys.manage',
        'onemcp:audit.read',
      ],
    },
    {
      key: 'onemcp.admin',
      description: 'Full control over OneMCP: approve MCP + skills, manage departments/spaces/users',
      permissions: [
        'onemcp:kb.read', 'onemcp:kb.write', 'onemcp:kb.delete',
        'onemcp:mcp.list', 'onemcp:mcp.register', 'onemcp:mcp.approve', 'onemcp:mcp.invoke',
        'onemcp:skills.list', 'onemcp:skills.submit', 'onemcp:skills.approve', 'onemcp:skills.invoke',
        'onemcp:departments.manage', 'onemcp:spaces.manage', 'onemcp:spaces.grant',
        'onemcp:attachments.upload', 'onemcp:attachments.download',
        'onemcp:apikeys.manage', 'onemcp:audit.read', 'onemcp:audit.read_all',
        'onemcp:admin.settings', 'onemcp:admin.users',
      ],
    },
  ],
};
