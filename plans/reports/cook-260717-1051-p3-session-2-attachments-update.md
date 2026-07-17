# Cook Session 8 — P3 Part 2: Attachments (MinIO) + Update Flow

**Date:** 2026-07-17 · **Phase:** P3 Artifacts · **Progress:** ~85% P3 complete

## Delivered

### Attachments
- Migration `1720400000000-attachments.ts` — 1 table với FK artifact_id CASCADE, unique storage_key, index on artifact_id. Fields: filename, content_type, size_bytes, checksum_sha256 (SHA256 hex), storage_key, uploaded_by/at.
- `attachments/entities/attachment.entity.ts`
- `storage/minio.service.ts` — MinIO Node client wrapper. `onModuleInit` ensures bucket. Exports putObject/getObjectStream/removeObject.
- `storage/storage.module.ts` — Global module.
- `attachments/attachments.service.ts` — Content-Type whitelist (pdf/md/txt/png/jpg/docx), RBAC (owner + reviewer upload/delete, viewer download-if-published-only), SHA256 checksum compute, safe filename regex.
- `attachments/attachments.controller.ts` — 4 endpoints:
  - `GET /api/artifacts/:artifactId/attachments`
  - `POST /api/artifacts/:artifactId/attachments` (FileInterceptor, throttle 20/min)
  - `GET /api/attachments/:id/download` (stream + Content-Disposition)
  - `DELETE /api/attachments/:id`
- `attachments/attachments.module.ts` — `MulterModule.registerAsync` với memoryStorage + fileSize limit từ `ATTACHMENT_MAX_MB` env (default 100).

### Update flow
- DTO `updateArtifactSchema` — `expected_version_no` + body + optional structured/tags.
- `ArtifactsService.update()` — transaction: check `MAX(version_no) == expected_version_no` else 409 (optimistic lock). Insert new artifact_version với version_no+1, status=pending. Artifact.status reset về pending (currentVersionId giữ nguyên → viewer vẫn thấy bản published cũ).
- REST: `POST /api/artifacts/:id/versions` — Zod validate, throttle 20/min.

### Design choice: backend proxy upload (không presigned URL)
- Portal upload multipart → backend nhận qua Multer memoryStorage → putObject to MinIO → DB row.
- Download: portal fetch `/api/attachments/:id/download` → backend stream từ MinIO ra client.
- Tradeoff: bandwidth × 2 (client→backend→MinIO). Chấp nhận cho pilot 100MB cap. Presign optimization defer P6.
- **Không cần** nginx S3 passthrough / CORS config → deploy đơn giản.

### Env additions
- `MINIO_BUCKET=onemcp-artifacts` (default)
- `ATTACHMENT_MAX_MB=100` (default)

### Deps
- Backend runtime: `minio@^8.0.1`, `multer@^1.4.5-lts.1`
- Backend dev: `@types/multer`

## Delivered — Portal

- `lib/api/attachments.ts` — listAttachments, uploadAttachment (custom multipart fetch bỏ Content-Type header), downloadAttachmentUrl, deleteAttachment.
- `lib/api/artifacts.ts` bổ sung `updateArtifact()`.
- `components/attachment-uploader.tsx` — client component: file input filter accept list, upload button với busy state, list attachments (size human-readable, download link, delete button với confirm), error hiển thị inline.
- `app/artifacts/[id]/edit/page.tsx` — form update: load current version, expected_version_no auto-set, submit → new pending version.
- `app/artifacts/[id]/page.tsx` — thêm "Edit → new version" button + mount `<AttachmentUploader>`.

## Files
- Backend new: 6 (migration + entity + storage x2 + attachments service/controller/module)
- Backend modified: 4 (env.schema, data-source, app.module, docker-compose, artifacts.service, artifacts.controller, dto)
- Portal new: 3 (attachments API + uploader + edit page)
- Portal modified: 2 (artifacts API, detail page)
- Env: .env.example + docker-compose

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
- `Migration Attachments1720400000000` chạy
- `bucket "onemcp-artifacts" created` (lần đầu)
- Routes mới mapped: `/api/artifacts/:artifactId/attachments (GET/POST)`, `/api/attachments/:id/download (GET)`, `/api/attachments/:id (DELETE)`, `/api/artifacts/:id/versions (POST)`

## Verify workflow

```bash
# 1. Create artifact
curl -sk -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://onemcp.local/api/artifacts \
  -d '{"type":"kb","title":"Sepay webhook retry KB","slug":"kb-sepay-retry","body":"# Retry policy\n\nExponential backoff 5s...","tags":["sepay","payment"]}' | jq

# 2. Upload attachment (giả sử response artifact id=2)
echo "sample content" > /tmp/sample.md
curl -sk -X POST -H "X-Onemcp-User: alice" \
  -F "file=@/tmp/sample.md;type=text/markdown" \
  https://onemcp.local/api/artifacts/2/attachments | jq

# 3. List attachments
curl -sk -H "X-Onemcp-User: alice" https://onemcp.local/api/artifacts/2/attachments | jq

# 4. Download
curl -sk -H "X-Onemcp-User: alice" -o /tmp/dl.md \
  https://onemcp.local/api/attachments/1/download
diff /tmp/sample.md /tmp/dl.md   # Expect: identical

# 5. Update artifact (new pending version)
curl -sk -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://onemcp.local/api/artifacts/2/versions \
  -d '{"expected_version_no":1,"body":"# Retry policy v2\n\nAdded circuit breaker...","tags":["sepay","payment","circuit-breaker"]}' | jq

# 6. Optimistic lock conflict (dùng expected_version_no=1 nhưng đã lên v2)
curl -sk -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://onemcp.local/api/artifacts/2/versions \
  -d '{"expected_version_no":1,"body":"stale write"}' | jq
# Expect: 409 conflict

# 7. Check MinIO có object
docker compose exec -T minio mc alias set local http://localhost:9000 onemcp change-me-min-8-chars 2>&1
docker compose exec -T minio mc ls local/onemcp-artifacts/artifacts/2/
```

## Portal test (browser)

1. `/artifacts/2` — thấy nút "Edit → new version" + AttachmentUploader section.
2. Click **+ Upload** → chọn file .md/.pdf → xuất hiện trong list với size + content-type.
3. Click filename → download.
4. Click **Edit → new version** → form load body hiện tại + expected_version_no tự set → submit → redirect về detail với version mới (pending).
5. Approve như bình thường qua review actions.

## Security applied

- **Content-Type whitelist** 6 types (pdf/md/txt/png/jpg/docx). Không cho phép executable, shell script, .html (XSS vector).
- **Size cap** 100MB enforce ở Multer + fallback check ở controller.
- **SHA256 checksum** compute server-side, lưu — client không thể forge (attachment metadata trust từ server).
- **RBAC**: owner + reviewer upload/delete; viewer chỉ download nếu artifact published.
- **Storage key** dạng `artifacts/<id>/<uuid>-<safeName>` — safeName strip non-alnum để chống path traversal.
- **Optimistic lock** — chống lost-update khi 2 người edit đồng thời.

## Next Session (P3 Part 3 — final)

- [ ] Markdown renderer (rehype-sanitize) thay `<pre>` trong detail page
- [ ] Version history diff view (compare bodies)
- [ ] Notification stub (BullMQ email job) khi có pending review
- [ ] E2E test: create → upload → update → conflict → approve → download
- [ ] MCP `submit_attachment` tool (defer nếu không priority)

## Unresolved

- **MinIO bucket lifecycle** chưa config (retention, versioning). Nếu delete artifact → attachments CASCADE nhưng object trong MinIO không auto-remove. Cần cleanup job hoặc listen entity remove event (P6).
- **Antivirus scan** — không có. Chấp nhận rủi ro cho internal pilot.
- **Presigned URLs** — defer. Backend proxy hoạt động, chỉ nặng bandwidth khi file lớn.
- **Concurrent upload same filename** — hiện dùng UUID prefix nên OK; nếu client cần dedup phải check checksum trước upload.
- **CASCADE delete race**: nếu artifact xóa trong khi attachment upload đang progress → attachment row failed (FK), nhưng object đã ở MinIO → orphan. Rare edge case, chấp nhận.

## Session Metrics
- Files new: 8 (backend 6 + portal 3 - 1 modified)
- Files modified: 6
- LOC delta: ~700
- New REST endpoints: 5 (upload + list + download + delete + version)
- New DB table: 1
- Backend build: ✅ clean
