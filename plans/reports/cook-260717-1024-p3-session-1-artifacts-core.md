# Cook Session 6 — P3 Part 1: Artifacts Core (submit + review + list)

**Date:** 2026-07-17 · **Phase:** P3 Artifacts · **Progress:** ~40% P3 complete (session 1 of 3)

## Scope session 1 (shipped)

- Artifacts DB schema + entities + service + REST + MCP tools + portal (list, submit, detail, review queue).
- Workflow đầy đủ: contributor submit → pending → maintainer approve → published.
- Multi-tenant dept-scope + RBAC.

## Deferred (session 2 + 3)

- Attachments (MinIO presigned upload)
- Update artifact (tạo version mới, optimistic lock)
- Notifications (email stub) khi có pending review
- E2E tests

## Delivered — Backend

### DB
- Migration `1720300000000-artifacts.ts` — 2 tables + FK circular (artifacts.current_version_id ↔ artifact_versions), GIN index tags, indexes status/type.
- `data-source.ts` register 2 entities.

### Domain
- `artifacts/artifact-type.enum.ts` — union type: `report | research | kb` + status enums.
- `artifacts/entities/artifact.entity.ts` — top-level. Unique per (dept, slug). `currentVersionId` NULL cho tới khi approve lần đầu.
- `artifacts/entities/artifact-version.entity.ts` — append-only snapshot. Review data embed (reviewed_by/at/note).
- `artifacts/dto/submit-artifact.dto.ts` — Zod schema: type enum, title 3-255, slug regex, body max 2M chars, tags max 20. Review payload schema.

### Service `artifacts.service.ts`
- `create(user, dto)` — transaction: insert artifact + version_no=1, status=pending.
- `list(user, filter)` — dept-scope. Non-reviewer chỉ thấy published + own pending. Filter type/tag/q/status. Limit 100 (add pagination P6).
- `findOne(user, id)` — RBAC: non-reviewer/non-owner chỉ xem published. Reviewer + owner thấy latest version bất kể status.
- `listVersions(user, id)` — full history.
- `review(user, id, dto)` — maintainer+ only. Transaction: mark pending version active|rejected, set artifact.currentVersionId + status=published nếu approve.

### REST controller `artifacts.controller.ts`
- `GET /api/artifacts` — list, filter type/tag/q/status
- `GET /api/artifacts/:id` — detail (artifact + current version)
- `GET /api/artifacts/:id/versions` — full history
- `POST /api/artifacts` — submit (Zod validate, throttle 20/min)
- `POST /api/artifacts/:id/review` — approve/reject (throttle 20/min)

### MCP tools (bổ sung vào `mcp-tools.service.ts`)
- `list_artifacts(type?, tag?, q?)` — dept-scope list
- `get_artifact(id)` — trả về body + metadata header
- `submit_artifact(type, title, slug, body, structured?, tags?)` — dept-scope create, status=pending

Bây giờ MCP có 5 tools: `list_skills`, `load_skill`, `list_artifacts`, `get_artifact`, `submit_artifact`.

## Delivered — Portal

- `lib/api/artifacts.ts` — typed client: listArtifacts, getArtifact, listArtifactVersions, submitArtifact, reviewArtifact.
- `app/artifacts/page.tsx` — list + type filter chips + search + link vào review queue.
- `app/artifacts/new/page.tsx` — form: type radio, title, slug, tags, body markdown textarea (Tiptap defer).
- `app/artifacts/[id]/page.tsx` — detail render body monospace + review actions (approve/reject với note) hiển thị khi pending.
- `app/artifacts/review/page.tsx` — pending queue cho maintainer.
- `components/nav.tsx` — thêm link "Artifacts".

## Files count
- Backend new: 6 (migration + 4 artifacts + 0 changes to skills)
- Backend modified: 4 (data-source, app.module, mcp-tools.service, mcp.module)
- Portal new: 4 (list, new, detail, review queue) + 1 lib
- Portal modified: 1 (nav)
- Total: ~16 files, ~1000 LOC

Build: `pnpm build` clean ✅.

## Deploy staging

```bash
cd /opt/onemcp
git pull
docker compose build backend portal
docker compose up -d
docker compose logs backend --tail=50
```

Kỳ vọng log:
- `Migration Artifacts1720300000000` chạy → 2 tables added
- Routes mapped: `/api/artifacts (GET/POST)`, `/api/artifacts/:id (GET)`, `/api/artifacts/:id/versions (GET)`, `/api/artifacts/:id/review (POST)`
- MCP tools/list trả về 5 tools

## Verify workflow (REST)

```bash
# 1. Empty list
curl -sk -H "X-Onemcp-User: alice" https://onemcp.local/api/artifacts | jq

# 2. Submit (contributor)
curl -sk -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://onemcp.local/api/artifacts \
  -d '{"type":"report","title":"Payment incident 2026-Q3","slug":"payment-incident-2026-q3","body":"# Summary\n\nWebhook Sepay bị lỗi timeout ...","tags":["postmortem","payment"]}' | jq

# 3. List — alice thấy own pending
curl -sk -H "X-Onemcp-User: alice" https://onemcp.local/api/artifacts | jq

# 4. viewer (contributor role) khác dept sẽ ko thấy (test sau nếu có multi-dept)

# 5. Approve (admin)
curl -sk -X POST -H "X-Onemcp-User: admin" -H "Content-Type: application/json" \
  https://onemcp.local/api/artifacts/1/review \
  -d '{"action":"approve","note":"OK, well written"}' | jq
# Expect: artifact.status='published', currentVersionId=1

# 6. Detail cho anyone
curl -sk -H "X-Onemcp-User: bob" https://onemcp.local/api/artifacts/1 | jq
# Bob (contributor) — thấy vì status=published
```

## Verify MCP

```bash
docker compose exec -T backend wget -qO- \
  --header="X-Onemcp-User: alice" \
  --header="Content-Type: application/json" \
  --post-data='{"jsonrpc":"2.0","id":10,"method":"tools/list"}' \
  http://127.0.0.1:3000/api/mcp | jq '.result.tools[].name'
# Expect: list_skills, load_skill, list_artifacts, get_artifact, submit_artifact

docker compose exec -T backend wget -qO- \
  --header="X-Onemcp-User: alice" \
  --header="Content-Type: application/json" \
  --post-data='{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"submit_artifact","arguments":{"type":"kb","title":"How to reset payment webhook","slug":"kb-reset-payment-webhook","body":"# Steps\n\n1. ...\n2. ..."}}}' \
  http://127.0.0.1:3000/api/mcp | jq

docker compose exec -T backend wget -qO- \
  --header="X-Onemcp-User: alice" \
  --header="Content-Type: application/json" \
  --post-data='{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"list_artifacts","arguments":{}}}' \
  http://127.0.0.1:3000/api/mcp | jq
```

## Portal test (browser)
1. Login as `alice` (contributor) → `/artifacts` → click "+ Submit".
2. Điền form → submit → redirect vào detail (status=pending).
3. Login as `admin` (super-admin, from ADMIN_ALLOW_CIDR) → `/artifacts/review` → click item → approve.
4. Back to alice → refresh → status=published.

## Bảo mật + design choices

- **RBAC ở service layer** — controller mỏng, ACL check tập trung. Non-reviewer chỉ list published + own pending.
- **Transaction** — create + review dùng `ds.transaction()` để tránh half-write giữa artifacts + artifact_versions.
- **Append-only versions** — không mutate SKILL.md pattern, giữ history đầy đủ.
- **Multi-tenant** — `department_id` NOT NULL + WHERE clause mọi query, không có cross-dept leak.
- **Rate limit** — submit + review 20/min per IP (chống spam).
- **Slug validation** — regex `^[a-z0-9][a-z0-9-]*$` chống SQL injection + URL nasties.
- **Body cap** — Zod max 2M chars enforce ở REST + MCP submit.

## Next Session (P3 Part 2)

- [ ] MinIO client + bucket `onemcp-attachments`
- [ ] Attachment entity + presign PUT/GET flow
- [ ] Portal attachment uploader
- [ ] Update artifact (POST /api/artifacts/:id/versions) — tạo pending version mới
- [ ] Optimistic lock: `expected_version_no` param
- [ ] Notification stub — enqueue email khi có pending review

## Next Session (P3 Part 3)

- [ ] E2E test full workflow (submit → review → publish, RBAC negatives)
- [ ] Docs: `docs/api-artifacts.md`
- [ ] Portal: markdown render qua rehype-sanitize (thay textarea readonly)

## Unresolved

- **Content-Type sanitization**: portal hiện render body qua `<pre>` (safe). Khi thay bằng markdown renderer phải sanitize XSS (rehype-sanitize).
- **Bigint IDs**: TypeORM trả `id` là string. Portal type đã `string`. Nếu FE cần sort numeric phải parseInt.
- **Search FTS**: hiện chỉ ILIKE title/slug. Body search + tsvector + pgvector defer đến P4.
- **Concurrent submit same slug**: race → 1 succeeds, 1 sẽ 400 (unique constraint). OK cho v1.

## Session Metrics
- Files created: 12
- Files modified: 5
- LOC delta: ~1000
- New REST endpoints: 5
- New MCP tools: 3
- New DB tables: 2
- Backend build: ✅ clean
