# Cook Session 5 — P2 Part 3: MCP Server + Fixes

**Date:** 2026-07-17 · **Phase:** P2 Skills Registry · **Progress:** ~95% P2 complete

## Delivered

### Fix session 4 warnings
- `docker-compose.yml`: Redis `maxmemory-policy` `allkeys-lru` → `noeviction` (BullMQ requirement — không mất job).
- Cần user chỉnh `.env` VPS: `GITLAB_BASE_URL=` (empty) hoặc set proper URL — hiện cron enqueue jobs mà sync fail vì gitlab.internal unreachable.

### Body storage cho SKILL.md
- Migration `1720200000000-skill-version-body.ts` — `ALTER TABLE skill_versions ADD COLUMN body TEXT`.
- `SkillVersion` entity thêm `body: string | null`.
- `skill-sync.service.ts` — sau khi parse manifest, `git show <sha>:skills/<name>/SKILL.md` → lưu vào `body`. Fail sync nếu thiếu SKILL.md.

Kết quả: MCP `load_skill` đọc body từ DB, không cần git ở read path (latency thấp, tách MCP khỏi phụ thuộc GitLab live).

### MCP module (mới)
- `mcp/mcp-jsonrpc.types.ts` — types cho JSON-RPC 2.0 + MCP protocol version + tool definition/result shapes + error codes.
- `mcp/mcp-tools.service.ts` — 2 tools:
  - `list_skills(tag?, q?)` → text bullet list dept-scoped skills
  - `load_skill(name)` → markdown header + body (SKILL.md). Log `skill_load_events` row (user, ip, skill_id, version_id, timestamp).
- `mcp/mcp.controller.ts` — `POST /api/mcp`. Handle methods:
  - `initialize` → serverInfo + capabilities.tools
  - `ping` → {}
  - `tools/list` → tool defs
  - `tools/call` → dispatch to McpToolsService
  - `notifications/*` → ack empty
  - unknown → JSON-RPC method-not-found
- `mcp/mcp.module.ts` — wire vào AppModule.

**Design choice**: implement JSON-RPC handler thủ công thay vì import `@modelcontextprotocol/sdk`. Lý do:
- SDK phụ thuộc raw Node HTTP handler, khó tích hợp Express/Nest pipeline.
- Chỉ cần 3 methods (`initialize`, `tools/list`, `tools/call`) — surface nhỏ, YAGNI-compliant.
- Access control (IP CIDR + trust header) reuse toàn bộ pipeline hiện tại — không cần MCP-specific middleware.

### Access reuse
MCP endpoint không cần bypass gì — chạy qua `IpCidrGuard` (client trong USER_ALLOW_CIDR) + `TrustUserMiddleware` (X-Onemcp-User → req.user). AI agent gọi MCP với 2 header:
```
X-Onemcp-User: alice
Content-Type: application/json
```

## Files
- New: 4 backend (mcp/*) + 1 migration
- Modified: 4 backend (entity, sync service, app.module, docker-compose)

Build: `pnpm build` clean ✅.

## Deploy staging

```bash
cd /opt/onemcp
# 1. Fix .env warning session 4:
sed -i 's|^GITLAB_BASE_URL=.*|GITLAB_BASE_URL=|' .env

# 2. Pull + rebuild backend
git pull
docker compose build backend
docker compose up -d

# 3. Verify boot
docker compose logs backend --tail=50
```

Kỳ vọng thấy:
- `Mapped {/api/mcp, POST}` route
- `SkillSyncCron: GITLAB_BASE_URL empty — skipping resync scheduler` (fix warning)
- Redis không còn log `Eviction policy should be noeviction`
- Migration `SkillVersionBody1720200000000` chạy — column `body` được add

## Verify MCP

```bash
# 1. Initialize
curl -k -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://onemcp.local/api/mcp \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
# Expect: { result: { protocolVersion, capabilities, serverInfo: {name:"onemcp",...} }, id:1 }

# 2. List tools
curl -k -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://onemcp.local/api/mcp \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
# Expect: tools: [{name:"list_skills",...}, {name:"load_skill",...}]

# 3. Call list_skills
curl -k -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://onemcp.local/api/mcp \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_skills","arguments":{}}}'
# Expect: content: [{text: "Found 2 skill(s):\n- debug-guide — ..."}]

# 4. Call load_skill (chưa có body do chưa sync)
curl -k -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://onemcp.local/api/mcp \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"load_skill","arguments":{"name":"debug-guide"}}}'
# Expect: content với body = "(no body content — chưa sync từ git)". Load event ghi vào skill_load_events.

# 5. Seed body manual để test end-to-end
docker compose exec -T postgres psql -U onemcp onemcp <<'EOF'
UPDATE skill_versions SET body = '# Debug Guide

## Bước 1: Check logs
- kibana search theo error message
- correlate request_id

## Bước 2: Reproduce local
- docker compose up -d
- postman collection ...
' WHERE id = 1;
EOF

# 6. Lặp lại call load_skill → thấy body content trả về đầy đủ.

# 7. Verify load event log
docker compose exec -T postgres psql -U onemcp onemcp -c "SELECT skill_id, username, ip, created_at FROM skill_load_events ORDER BY created_at DESC LIMIT 5;"
```

## Claude Code client config (test từ dev machine)

Trong `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "onemcp": {
      "type": "http",
      "url": "https://onemcp.local/api/mcp",
      "headers": { "X-Onemcp-User": "alice" }
    }
  }
}
```

Claude Code sẽ call `initialize` + `tools/list` khi boot, và `tools/call` khi user yêu cầu. Tools tự động populate vào ability set của agent.

## Bảo mật đã áp dụng

- **C1**: `load_skill` chỉ trả active version (currentVersionId), không load pending/rejected. Body sync từ approved commit.
- **Multi-tenant**: dept scope enforce ở service — user dept khác không thấy được skill.
- **Audit**: mỗi call `load_skill` ghi `skill_load_events` với ip + user + version_id (H4 mitigation — track skill usage).

## Roadmap remainder

### P2 Part 3.5 (small tail — cân nhắc)
- [ ] MCP SSE transport nếu Claude Code client require notifications real-time (hiện HTTP POST đủ)
- [ ] `submit_artifact` MCP tool (P3 handoff — post-session artifact write)
- [ ] Rate limit `/api/mcp` per user (chống abuse)

### P3 Artifacts Core (next wave)
- Artifact entity (reports/research/kb)
- MinIO upload
- Full-text search prep (pgvector wave 4)

## Session Metrics
- Files new: 5 (4 mcp/* + 1 migration)
- Files modified: 4
- LOC delta: ~250
- New endpoints: 1 (POST /api/mcp)
- Backend build: ✅ clean

## Unresolved

- MCP client tương thích: chưa verify với Claude Code thực tế (spec 2024-11-05 base). Nếu client Claude Code yêu cầu SSE (`text/event-stream`) thay vì JSON response, cần thêm content-negotiation.
- `load_skill` không stream body — cả file dumped trong single response. Với SKILL.md ngắn (<50KB) OK; nếu tương lai skill có resources[] cần load kèm, phải add tool riêng hoặc streaming.
- `X-Onemcp-User` chỉ là trust header v1. AI agents từ máy dev sẽ config username thủ công — chưa có SSO. Đúng thiết kế v1 defer auth.
- Test coverage — chưa có e2e test cho MCP flow (webhook → sync → load). Sẽ add ở P6 hardening.
