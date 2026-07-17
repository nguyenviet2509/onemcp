# Phase 03 — Artifacts Core

**Priority:** High
**Status:** pending
**Est.:** 2 tuần
**Depends on:** P1 (auth, RBAC, audit), P2 (MCP server module, PAT)

## Overview
CRUD artifacts (report/research/KB) với versioning, attachments MinIO, MR-style review workflow (pending → approve/reject → published).

## Key Insights
- **Append-only versions** — không mutate content cũ, chỉ point current_version_id sau approve.
- **Structured field jsonb** — lưu sections/fields theo template để render nhất quán trong portal.
- **Attachments qua MinIO presigned URL** — backend không proxy binary (giảm tải).

## Requirements

### Functional
- 3 artifact types: `report`, `research`, `kb`.
- CRUD endpoints REST + MCP tools (`submit_artifact`, `get_artifact`, `list_artifacts`, `update_artifact`).
- Versioning: mỗi update tạo `artifact_version` mới, status=pending.
- Attachments: portal + MCP upload qua presigned URL, backend ghi metadata.
- Review workflow: maintainer approve/reject qua portal → notify author (email/webhook stub).
- Only published version visible cho non-maintainer.

### Non-Functional
- Payload cap: 2MB text body, attachment ≤ 100MB.
- Concurrent update qua optimistic locking (`version_no`).
- Soft delete only (audit trail).

## Architecture

```
[Agent/User] ──submit_artifact──► [ArtifactsController]
                                        │
                          [ArtifactsService]
                                        │
                    ┌──────────────────┴─────────────────┐
                    │ create artifact + artifact_version │
                    │ status=pending, version_no=1       │
                    └──────────────────┬─────────────────┘
                                       │
                          [enqueue embedding job] (P4)
                                       │
                                 [audit event]
                                       │
   [Maintainer] ──approve/reject──► [ReviewController]
                                       │
                          update artifact.current_version_id
                                       │
                                status=published
```

## Related Code Files (to create)

### backend/
```
src/artifacts/
├── artifacts.module.ts
├── entities/artifact.entity.ts
├── entities/artifact-version.entity.ts
├── entities/artifact-review.entity.ts
├── entities/attachment.entity.ts
├── artifacts.service.ts
├── artifacts.controller.ts                     # REST
├── reviews.controller.ts                       # approve/reject
├── attachments.service.ts                      # presign
├── attachments.controller.ts                   # presign issue/complete
├── dto/
│   ├── submit-artifact.dto.ts
│   ├── update-artifact.dto.ts
│   └── review-artifact.dto.ts
└── artifact-type.enum.ts

src/mcp/tools/
├── submit-artifact.tool.ts
├── get-artifact.tool.ts
├── list-artifacts.tool.ts
└── update-artifact.tool.ts

src/storage/
├── storage.module.ts
├── minio-client.provider.ts
└── minio.service.ts                            # presign put/get, bucket policies

src/db/migrations/1720200000000-artifacts.ts
```

### portal/
```
app/artifacts/
├── page.tsx                                    # list + filter type/status/tag
├── new/page.tsx                                # create form
├── [id]/page.tsx                               # detail + version history
├── [id]/edit/page.tsx
└── review/page.tsx                             # queue for maintainers

components/
├── artifact-editor.tsx                         # Tiptap or textarea + section builder
├── attachment-uploader.tsx                     # presigned upload
└── review-actions.tsx

lib/api/artifacts.ts
```

## Implementation Steps

1. **DB migration** — artifacts, artifact_versions (jsonb `structured`, text `body`, ready cột `tsvector` + `embedding` cho P4), artifact_reviews, attachments. FK department_id.
2. **Storage module** — MinIO client, bucket `onemcp-attachments` với versioning bật, lifecycle policy.
3. **Attachments** — presign PUT flow: portal request presign → upload trực tiếp MinIO → callback `POST /attachments/complete` với etag/size/checksum.
4. **Artifacts service** — create (v1), update (new version), get (published only nếu không phải maintainer + author), list (filter type, status, tag, dept).
5. **REST controller** — RBAC: contributor create/update-own, maintainer view-all + review, viewer read-published.
6. **Review controller** — approve → transaction: update artifact.current_version_id, status=published; reject → status=rejected + note.
7. **MCP tools** — submit_artifact (schema validate ở P5), get_artifact, list_artifacts, update_artifact. All ghi audit + trả về structured error.
8. **Portal artifact list** — TanStack Query, filter chips, status badges.
9. **Portal editor** — form dựng theo `structured` schema (title, summary, sections[], tags, references, attachments). Save = submit_artifact call.
10. **Portal review queue** — maintainer view pending, diff giữa version cũ/mới, approve/reject action.
11. **E2E** — create → pending → maintainer approve → visible cho viewer + list_artifacts trả về.

## Todo
- [ ] Artifacts migration
- [ ] MinIO client + bucket setup + lifecycle
- [ ] Attachments presign flow
- [ ] Artifact entities + service
- [ ] REST controllers (CRUD + review)
- [ ] RBAC rules per action
- [ ] MCP submit/get/list/update tools
- [ ] Optimistic locking on update
- [ ] Portal list + filter page
- [ ] Portal create/edit editor
- [ ] Portal attachment uploader
- [ ] Portal review queue + diff view
- [ ] Notification stub (email queue)
- [ ] E2E full workflow test
- [ ] Compile check
- [ ] Docs: artifact API reference

## Success Criteria
- Contributor submit artifact → status=pending, không xuất hiện public search.
- Maintainer approve → status=published, hiển thị cho viewer, current_version pointer đúng.
- Update tạo version mới, giữ version cũ trong DB.
- Attachment upload qua presigned URL, metadata ghi + accessible via GET presign.
- Optimistic lock reject concurrent update với 409.

## Risk Assessment
- **Large text body** → cap 2MB, khuyến khích attach file cho content dài.
- **Presign expiry mismatch** → PUT presign 10 phút, GET 5 phút; UI refresh khi expired.
- **Review queue backlog** → alert maintainer nếu >20 pending >48h (P6).
- **JSONB schema drift** → template_version field trong `structured`, migration helper P5.

## Security Considerations
- MinIO bucket private, chỉ presign truy cập.
- Content-Type whitelist (pdf, md, txt, png, jpg, docx).
- Checksum verify sau upload complete.
- Presign URL scope theo user + object key + expiry ngắn.
- XSS: portal render markdown qua sanitizer (rehype-sanitize).

## Next Steps
- P4 gắn embedding worker vào submit flow.
- P5 gắn template validate vào submit_artifact tool.
