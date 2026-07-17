# OneMCP — Department MCP Server (Brainstorm Report)

**Date:** 2026-07-16
**Owner:** trihd@inet.vn
**Scope v1:** Phòng Kỹ thuật (pilot), schema multi-tenant sẵn sàng.

## 1. Problem Statement
Xây MCP server nội bộ để phòng ban (Kỹ thuật trước) chia sẻ skills, artifacts (report/research/KB), có SSO, RBAC, audit, contribution qua git, storage lâu dài, template-enforced output. Mục tiêu: chuẩn hóa cách AI agents nội bộ khám phá/nạp skills và đóng góp kiến thức tái sử dụng được toàn phòng.

## 2. Requirements

### Functional
- SSO: INET (primary) + GitLab (dev linking).
- RBAC 5 role: viewer, contributor, maintainer, dept-admin, super-admin.
- MCP tools: `list_skills`, `load_skill`, `list_artifacts`, `get_artifact`, `submit_artifact`, `search_artifacts` (FTS + semantic).
- Skills lifecycle: git-native source + DB metadata registry, MR review bắt buộc, webhook sync.
- Artifacts CRUD + versioning + attachments + MR-style review.
- Audit toàn bộ hành vi (login, load, submit, approve, admin ops).
- Template enforcement: MCP prompt resource + JSON schema validate ở submit tool.
- Session-wrapup skill: instruct agent submit artifact trước khi kết thúc phiên.

### Non-Functional
- On-prem/private cloud + VPN.
- Full-text VN+EN + semantic search.
- Retention audit 2 năm hot.
- Multi-tenant-ready schema (department_id FK).

## 3. Approaches Evaluated

### A. Monolith share chung, RBAC scope
- Pros: đơn giản, share KB dễ, ít infra.
- Cons: blast radius lớn nếu dept muốn isolate mạnh.

### B. Multi-tenant per-dept namespace từ đầu
- Pros: tương lai-proof, isolation rõ.
- Cons: over-engineer cho v1 chỉ 1 dept.

### C. **Hybrid — chọn** (monolith + multi-tenant schema)
- 1 codebase, 1 DB, tất cả bảng có `department_id`, v1 chỉ 1 dept nhưng path scale sang N dept không cần refactor.
- Pros: KISS ngay + không nợ kỹ thuật khi mở rộng.

## 4. Final Architecture

### Stack
| Layer | Choice |
|---|---|
| Backend | NestJS + TypeScript |
| MCP transport | Streamable HTTP + SSE |
| DB | PostgreSQL 16 + pgvector + FTS (unaccent) |
| Object store | MinIO (S3-compat, self-host) |
| Queue | Redis + BullMQ |
| Git | GitLab self-host (existing) |
| Web | Next.js 15 + shadcn/ui |
| Embedding | multilingual-e5-small trên CPU (ONNX Runtime), upgrade path → bge-m3 → GPU |
| Deploy | Docker Compose (v1), K8s khi scale |

### Component map
- **Auth Gateway**: INET OIDC/SAML → JWT session; GitLab OAuth linking để verify commit author.
- **Skills Registry**: GitLab webhook consumer, manifest validator, RBAC-filtered `list/load`.
- **Artifacts Service**: CRUD + versioning + attachments MinIO ref + review workflow.
- **Search Service**: Postgres FTS (VN+EN qua unaccent + simple config) + pgvector semantic.
- **Embedding Worker**: BullMQ consumer, e5-small ONNX inference, batch embed pending artifacts.
- **Template Validator**: JSON schema per artifact type (report/research/kb).
- **Audit Logger**: append-only `audit_events` table, portal viewer cho admin.

### DB core tables
```
users(id, inet_sub, gitlab_id, email, name, department_id, created_at)
departments(id, code, name)
roles(id, code)
user_roles(user_id, role_id, department_id)
skills(id, name, dept_id, repo_url, current_version, owner_id, status)
skill_versions(id, skill_id, commit_sha, manifest jsonb, approved_by, approved_at)
skill_load_events(id, user_id, skill_id, version_id, ts)
artifacts(id, type, dept_id, current_version_id, author_id, status, created_at)
artifact_versions(id, artifact_id, title, body, structured jsonb, tags text[],
                  tsv tsvector, embedding vector(384), version_no, author_id, created_at)
artifact_reviews(id, artifact_id, version_id, reviewer_id, decision, note, ts)
attachments(id, artifact_version_id, minio_key, mime, size, checksum)
audit_events(id, actor_id, action, resource_type, resource_id, before jsonb,
             after jsonb, ip, session_id, ts)
```

### Skills lifecycle
1. Dev clone `gitlab/onemcp/skills-kythuat`, tạo `skills/<name>/{SKILL.md,manifest.yaml,...}`.
2. MR → CI validate manifest schema + secret/dangerous-import scan.
3. Maintainer approve → merge main → GitLab webhook → registry insert `skill_versions` (commit_sha, manifest, status=active).
4. MCP `list_skills` → filter RBAC (dept_id + role) → return metadata.
5. MCP `load_skill(name, version?)` → server checkout commit từ local mirror → stream nội dung + resources.
6. Ghi `skill_load_events` cho audit + usage analytics.

### Artifact lifecycle
1. Agent gọi MCP tool `submit_artifact` với payload theo JSON schema (title, type, sections, tags, references, attachments[]).
2. Server validate schema → tạo `artifact` + `artifact_version` status=pending.
3. Enqueue embedding job → worker cập nhật `embedding`.
4. Maintainer review qua portal → approve/reject; approve chuyển status=published, visible cho `search_artifacts`.
5. Update = tạo `artifact_version` mới, current pointer chuyển sau approve.

### Template enforcement (hybrid)
- **Prompt resource** `templates/{report,research,kb}.md` được expose qua MCP → agent load trước khi viết.
- **JSON schema** trên `submit_artifact` reject payload thiếu field bắt buộc; error message hướng dẫn agent tự sửa.
- **Session-wrapup skill** (mandatory global rule của phòng): trước khi end session, agent phải gọi `submit_artifact` cho các finding tích lũy hoặc gọi `skip_artifact(reason)` để log lý do.

### Embedding strategy (không cần GPU v1)
- Model: `multilingual-e5-small` (384 dim, ~470MB) chạy ONNX Runtime trên CPU.
- Query embed <500ms trên VPS 8 vCPU, đủ cho load pilot.
- Upgrade path: đổi sang `bge-m3` (1024 dim) khi recall không đủ; thêm GPU (T4/3060) nếu throughput trên 100 doc/phút.
- Reserved DB column type để migrate dim: giữ v1 ở `vector(384)`, migration tạo cột mới khi đổi model, không drop cột cũ trong window transition.

### Auth flow
- INET OIDC (fallback SAML nếu chỉ có SAML) → NestJS Passport strategy → issue JWT (15 min) + refresh (7 day) cookie httpOnly Secure.
- GitLab OAuth linking: user vào portal → "Link GitLab" → OAuth code flow → lưu `gitlab_id` vào `users`.
- MCP client auth: portal issue **personal access token** (scoped: read-skills, submit-artifacts...) → client gửi qua `Authorization: Bearer`.

### Audit
- Middleware NestJS log mọi mutation + login/logout.
- Append-only (không update/delete audit rows).
- Portal admin viewer: filter theo actor/action/resource/date range.
- Retention: 2 năm hot PG; sau đó dump ra MinIO cold archive theo tháng.

## 5. Phased Roadmap

| Phase | Deliverable | Est. |
|---|---|---|
| P1 Foundation | Docker Compose infra (PG, Redis, MinIO), Auth (INET+GitLab), user/dept/role, portal skeleton, audit logger | 2 tuần |
| P2 Skills Registry | GitLab webhook, manifest validator, CI scanner, MCP list/load_skill, portal browse | 2 tuần |
| P3 Artifacts Core | CRUD + versioning + MR-style review UI, MinIO attachments, submit_artifact MCP tool | 2 tuần |
| P4 Search | Postgres FTS (VN+EN), embedding worker (e5-small ONNX), semantic search API + MCP tool | 1.5 tuần |
| P5 Templates & Session | Prompt resources, JSON schemas, session-wrapup skill, end-of-session enforcement | 1 tuần |
| P6 Hardening | Audit viewer, admin dashboard, backup/DR runbook, load test, security review | 1.5 tuần |

Tổng: ~10 tuần cho 2 dev fullstack.

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| INET SSO protocol chưa rõ | Confirm sớm P1 kickoff; abstraction Passport strategy để swap OIDC↔SAML |
| Skill code chạy tùy tiện | MR review + CI scanner + manifest permission declaration; sandbox nếu skill có runtime code |
| Agent bỏ qua template | Schema validate ở server + session-wrapup skill làm mandatory rule |
| Embedding chậm trên CPU | Async job + accept 5–30s để search-ready; monitor P95 |
| Multi-tenant retrofit | `department_id` NOT NULL từ đầu, tất cả query filter theo dept |
| Data loss | PG WAL archive → MinIO daily; MinIO versioning bật cho attachments |

## 7. Success Metrics
- 100% skill loads ghi audit.
- P95 search latency < 800ms (FTS) / < 1.2s (semantic).
- >80% session của Kỹ thuật kết thúc có ít nhất 1 artifact submit hoặc skip-with-reason.
- 0 skill deploy skip review (100% qua MR).
- Uptime 99.5%.

## 8. Unresolved Questions
- INET SSO cụ thể là OIDC hay SAML, có test IdP sandbox không?
- GitLab self-host version + có Container Registry chạy CI không?
- Team pilot bao nhiêu dev (ảnh hưởng size VPS)?
- Có VPS sẵn hay cần provision mới? RAM/CPU spec?
- Attachments size cap (5MB? 100MB?) và retention.
- Skill có được chạy code trong MCP server (sandbox) hay chỉ serve static content (SKILL.md + resources)?
