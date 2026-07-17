---
title: OneMCP — Department MCP Server (v1: Kỹ thuật pilot)
slug: onemcp-department-mcp-server
created: 2026-07-16
status: pending
blockedBy: []
blocks: [260716-1437-wave-2-hardening-rollout, 260716-1451-auth-integration]
brainstorm: ../reports/brainstorm-260716-1112-onemcp-department-mcp-server.md
---

# OneMCP — Implementation Plan

Green field. Build internal MCP server for departments, pilot Kỹ thuật. See brainstorm report for full design rationale.

## Primary Use Case (must-hit)
**Bug-trace knowledge reuse.** Dev A resolve production bug → viết KB → Dev B (3 tháng sau) gặp bug tương tự → paste error message vào AI agent → agent gọi `search_artifacts` → tìm được KB Dev A → apply fix trong vài phút thay vì trace lại từ đầu.

Plan tối ưu cho scenario này qua:
- **KB schema** yêu cầu `symptoms[]` + `root_cause` + `solution` (P5) — dev sau paste error message match được exact.
- **FTS weight A** cho `title + symptoms + tags` (P4) — boost recall khi query = error message.
- **Semantic search** (pgvector) fallback cho query paraphrase.
- **`session-wrapup` skill** mandatory nhắc Dev A submit KB trước khi end session (P5).
- **Attachments MinIO** cho log/stack trace/screenshot đi kèm KB (P3).
6
## Stack Summary
- **Backend:** NestJS + TypeScript, MCP streamable HTTP+SSE
- **Portal:** Next.js 15 + shadcn/ui
- **DB:** PostgreSQL 16 + pgvector + FTS (unaccent)
- **Object store:** MinIO (S3-compat)
- **Queue:** Redis + BullMQ
- **Access control (v1):** IP CIDR allowlist + `X-Onemcp-User` trust header (mode B). Full auth defer sang plan [260716-1451-auth-integration](../260716-1451-auth-integration/plan.md) sau v1.
- **Git:** GitLab self-host (existing) — webhook consumer only trong v1 (không OAuth linking).
- **Embedding:** multilingual-e5-small ONNX on CPU (upgrade path → bge-m3/GPU)
- **Deploy:** Docker Compose on private cloud + VPN

## Auth Deferral (chốt bởi user)
V1 KHÔNG có INET SSO / GitLab OAuth / JWT / cryptographic auth. Thay bằng:
- **IP CIDR allowlist** — env `USER_ALLOW_CIDR` + `ADMIN_ALLOW_CIDR`.
- **Trust header** — client tự khai username qua `X-Onemcp-User`, backend upsert user.
- **Role via env** — `MAINTAINER_USERNAMES` + `ADMIN_USERNAMES` list, default `contributor`.
- Users table schema đầy đủ (inet_sub, gitlab_id NULLABLE) — sẵn sàng populate khi auth ready.

Auth full integration = plan riêng, cook sau P6.

## Phases

| # | Phase | Status | Est. |
|---|---|---|---|
| P1 | [Foundation](./phase-01-foundation.md) — infra, IP CIDR + trust header, portal skeleton, audit | pending | 2 tuần |
| P2 | [Skills Registry](./phase-02-skills-registry.md) — GitLab webhook, manifest, MCP list/load (static-only) | pending | 2 tuần |
| P3 | [Artifacts Core](./phase-03-artifacts-core.md) — CRUD, versioning, review, attachments | pending | 2 tuần |
| P4 | [Search](./phase-04-search.md) — FTS + embedding worker + semantic search | pending | 2 tuần |
| P5 | [Templates & Session](./phase-05-templates-session.md) — prompts, schemas, session-wrapup | pending | 1.5 tuần |
| P6 | [Hardening](./phase-06-hardening.md) — audit viewer, admin, backup, load test, security | pending | 2 tuần |
| P6.5 | [Client-side Enforcement](./phase-06-5-client-side-enforcement.md) — Claude Code stop-hook verify submit | pending | 1 tuần |

Tổng: ~12.5 tuần cho 2 dev fullstack (buffer 30% cho critical mitigations từ red-team review).

**Post-v1:** Plan [auth-integration](../260716-1451-auth-integration/plan.md) thêm ~1.5-2w để tích hợp INET SSO thật.

## Key Dependencies (external)
- ~~INET SSO IdP endpoint~~ **(defer)** — không cần cho v1.
- GitLab self-host admin access (chỉ cần cho webhook + skills repo, KHÔNG cần OAuth app trong v1).
- VPS production (8 vCPU, 32 GB RAM, 1 TB NVMe SSD, Ubuntu 24.04) + VPS staging (4 vCPU, 8 GB, 200 GB, Ubuntu 24.04).
- External S3-compatible storage (NAS company hoặc MinIO khác) cho backup mirror daily.
- Domain + TLS cert cho portal + MCP endpoint (self-signed OK vì VPN-only).
- Danh sách IP CIDR internal của công ty (dải LAN).

## Cross-Phase Concerns
- **Multi-tenant readiness:** mọi bảng dữ liệu có `department_id NOT NULL` từ P1.
- **Audit:** middleware ghi log áp cho tất cả mutation từ P1 trở đi.
- **RBAC:** guards NestJS check role + dept scope trên mọi resolver/controller.

## Success Criteria (v1)
- 100% skill load ghi audit.
- P95 search < 800ms (FTS) / < 1.2s (semantic).
- >80% session Kỹ thuật kết thúc có artifact submit hoặc skip-with-reason.
- 0 skill deploy skip MR review.
- Uptime 99.5% trong 30 ngày pilot.
- **Bug-trace KB reuse (primary use case):**
  - ≥ 10 KB bug-trace published trong 30 ngày pilot.
  - Query bằng exact error message → KB liên quan xuất hiện trong top 3 (test bằng 20 sample queries).
  - ≥ 3 documented case Dev B tiết kiệm >1h nhờ reuse KB Dev A (thu qua survey/feedback form trong portal).

## Locked Decisions (from validation interview 2026-07-16)
- ✅ Timeline: 12-13 tuần realistic với buffer 30%.
- ✅ P6.5 Client-side hard enforcement bổ sung v1 (không đợi Wave 2).
- ✅ OS: Ubuntu 24.04 LTS.
- ✅ Staging VPS: 4vCPU/8GB/200GB.
- ✅ Default role trust header: `contributor`.
- ✅ Backup: MinIO on VPS + external S3 mirror daily.
- ✅ IP CIDR: users `10.0.14.0/24`, admin `192.168.122.0/24`.
- ✅ Skills runtime: static-only v1 (SKILL.md + resources, không execute code).

## Unresolved (v1)
- GitLab version + Container Registry availability.
- Pilot team size (dev count).
- Attachment size cap + retention chính sách.
- External S3 backup destination (NAS path/credentials).
