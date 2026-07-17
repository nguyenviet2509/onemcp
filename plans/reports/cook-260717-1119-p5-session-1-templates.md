# Cook Session 10 — P5 Part 1: Templates + Structured Content

**Date:** 2026-07-17 · **Phase:** P5 Templates · **Progress:** ~50% P5 (session 1 of 2)

## Scope

- Template schemas cho report/research/kb với sections bắt buộc/optional.
- Backend validate structured payload theo template + auto-compile body.
- MCP tool `get_artifact_template` cho AI agents discover schema.
- Portal dynamic editor render fields per template.
- Session-wrapup client-side enforcement — docs only (P6.5 defer).

## Delivered — Backend

### `artifacts/templates/`
- `template-registry.ts` — 3 templates:
  - **report**: summary, incident_timeline, root_cause, remediation (required) + action_items (optional).
  - **research**: question, methodology, findings (required) + references, next_steps (optional).
  - **kb**: problem, solution (required) + related (optional). Optimize cho bug-trace reuse: `problem` field placeholder = "Error message / log line dev tương lai paste khi search".
- `template-validator.ts` — validate structured JSONB theo template.fields.required/minLength/maxLength. `validateAndCompile()` trả về normalized structured + compiled body (markdown với `## Section` headers).
- `templates.controller.ts` — REST `GET /api/artifact-templates` + `GET /api/artifact-templates/:type`.

### Integration
- `dto/submit-artifact.dto.ts` — body optional (nếu structured cung cấp). Zod cho phép cả 2 shape.
- `artifacts.service.ts` — `prepareContent()`: nếu structured non-empty → validate + compile → body override. Nếu chỉ body → giữ nguyên (backwards compat). create + update dùng chung.
- MCP tool mới: `get_artifact_template(type)` → text response describe fields. Agent gọi TRƯỚC submit để avoid validation reject.

Backend build clean ✅. **7 MCP tools total**: list_skills, load_skill, list_artifacts, get_artifact, submit_artifact, search, get_artifact_template.

## Delivered — Portal

- `lib/api/templates.ts` — client fetch templates.
- `components/structured-editor.tsx` — dynamic form từ template.fields. markdown → textarea 6 rows mono, text → input. Hiển thị required*/minLength hints.
- `app/artifacts/new/page.tsx` — refactor: fetch template khi đổi type, render StructuredEditor thay textarea free-form.
- `app/artifacts/[id]/edit/page.tsx` — load structured từ current version, populate fields; submit structured only (không body).

## Delivered — Docs

- `docs/client-session-wrapup.md` — hướng dẫn 2 lớp enforcement:
  - Lớp 1 (đã có): skill `session-wrapup` load qua MCP.
  - Lớp 2 (P6.5 defer): Claude Code `.claude/settings.json` PreCompact hook. Sample hook script sẽ ship ở P6.5.

## Files
- Backend new: 3 (template-registry, template-validator, templates.controller)
- Backend modified: 5 (dto, service, module, mcp-tools, ...)
- Portal new: 2 (templates.ts, structured-editor.tsx)
- Portal modified: 2 (new/page.tsx, edit/page.tsx)
- Docs: 1

## Deploy

```bash
cd /opt/onemcp
git pull
docker compose build backend portal
docker compose up -d
docker compose logs backend --tail=30 | grep -E "Mapped.*artifact-templates|Bootstrap"
```

Kỳ vọng thêm 2 routes: `GET /api/artifact-templates` + `GET /api/artifact-templates/:type`.

## Verify

```bash
# 1. List templates
curl -sk -H "X-Onemcp-User: alice" https://onemcp.local/api/artifact-templates | jq

# 2. Get kb template
curl -sk -H "X-Onemcp-User: alice" https://onemcp.local/api/artifact-templates/kb | jq

# 3. Submit KB với structured
curl -sk -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://onemcp.local/api/artifacts \
  -d '{
    "type":"kb",
    "title":"Sepay webhook 502 timeout",
    "slug":"kb-sepay-502-timeout",
    "structured":{
      "problem":"Sepay webhook responds 502 after 30s. Log: \"upstream timed out (110: Operation timed out) while reading response header\".",
      "solution":"1. Increase nginx proxy_read_timeout to 60s in ops/nginx/sepay.conf.\n2. Add retry queue (BullMQ) with exponential backoff.\n3. Deploy: docker compose up -d nginx backend."
    },
    "tags":["sepay","timeout","incident"]
  }' | jq

# 4. Submit thiếu required → 400
curl -sk -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://onemcp.local/api/artifacts \
  -d '{"type":"kb","title":"Incomplete","slug":"kb-incomplete","structured":{"problem":"x"}}' | jq
# Expect: 400 with errors[problem:minLength 15, solution:required]

# 5. MCP get_artifact_template
docker compose exec -T backend wget -qO- \
  --header="X-Onemcp-User: alice" --header="Content-Type: application/json" \
  --post-data='{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_artifact_template","arguments":{"type":"report"}}}' \
  http://127.0.0.1:3000/api/mcp | jq

# 6. Portal — /artifacts/new: đổi type chip → thấy fields khác nhau
```

## Bug-trace KB reuse workflow (end-to-end)

Đây là use case chính. Sau P5.1, flow đầy đủ:

1. Dev A gặp bug → fix xong.
2. Agent Claude Code gọi `search` MCP với error message → không thấy KB tương tự.
3. Agent gọi `get_artifact_template("kb")` → biết cần fill `problem` + `solution`.
4. Agent gọi `submit_artifact({type:"kb", title, slug, structured:{problem:"...", solution:"..."}})`.
5. Maintainer approve qua portal → status=published, searchable.
6. **Vài tuần sau**: Dev B gặp bug tương tự → paste error → `search` return KB → apply fix trong 2 phút.

Mỗi bước có tool + endpoint. Không có lỗ hổng — chỉ chờ users thực sự adopt flow (P6.5 sẽ hard-enforce).

## Next Session

### P5 Part 2 (client-side enforcement + skill seeding)
- [ ] `onemcp-wrapup-check.py` — Claude Code hook script
- [ ] Sample `skills-kythuat/skills/session-wrapup/` folder (SKILL.md + manifest.json) — commit vào skills repo khi GitLab enable
- [ ] Portal render structured sections nicely (không chỉ `<pre>`)

### Hoặc chuyển sang:
- **P6 Hardening**: backups, monitoring, rate limit tuning
- **P4.2 Semantic**: pgvector embeddings
- **Auth v2**: SSO integration (defer plan)

## Unresolved

- **Portal render** structured hiện tại vẫn qua compiled body `<pre>` (đủ dùng vì có `## Section` headers). Rehype-sanitize + markdown render defer P3.3 hoặc P5.2.
- **Template version migration**: nếu tương lai bump template v2 với sections mới, existing artifacts (v1) không auto-migrate. Cần helper script khi có breaking change.
- **Free-form fallback**: nếu maintainer muốn submit KB không theo template (e.g. legacy import), path body-only vẫn work. Có thể sau này bắt buộc template — tùy policy.
- **Client hook**: script Python chưa viết, chỉ có docs. Users hiện tại phải manually gọi submit_artifact.
- **Legacy artifact "Test KB entry"** trên staging (created trước P5) sẽ không có structured — hiển thị body cũ, không ảnh hưởng.

## Session Metrics
- Files new: 6 (backend 3 + portal 2 + docs 1)
- Files modified: 7
- LOC delta: ~500
- New REST endpoints: 2 (templates list + detail)
- New MCP tool: 1 → 7 tools total
- Backend build: ✅ clean
