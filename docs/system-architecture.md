# OneMCP System Architecture

## Purpose

Internal knowledge platform cho engineering department. Bug-trace KB reuse — dev A trace + fix bug → capture KB → dev B tương lai paste error → tìm ra ngay → apply fix trong phút thay vì giờ.

## Component map

```
┌──────────────┐     https      ┌─────────┐   ┌──────────────────┐
│ Claude Code  │────────────────▶│ nginx   │──▶│ backend (NestJS) │
│ + hook       │                 │ 443     │   │ :3000            │
└──────────────┘                 └────┬────┘   └────┬─────────────┘
                                      │             │
┌──────────────┐                      │             ├─── postgres 16 + pgvector
│ Browser dev  │──────────────────────┤             ├─── minio (S3)
│ portal       │                      │             ├─── redis (BullMQ)
└──────────────┘                      │             └─── git-mirrors volume
                                      │
                                      └──────▶ portal (Next.js 15)
                                                :3000
```

## Layers

### Ingress
- **nginx:alpine** — TLS termination (self-signed lab), reverse proxy `/api/*` → backend, `/*` → portal. Resolver + variable-based proxy_pass (chống crash khi upstream chưa ready). SSE-friendly buffers cho MCP.

### Access control (v1 — pre-auth)
- **IP CIDR guard** (global) — allow chỉ `USER_ALLOW_CIDR`. `/health /ready /metrics` + `/api/webhooks/*` bypass.
- **Trust header middleware** — `X-Onemcp-User` regex `^[a-z0-9._-]{2,32}$`. Upsert user by username. Privileged role claim (super-admin/dept-admin/maintainer) chỉ chấp nhận từ `ADMIN_ALLOW_CIDR` (C1/C3 mitigation).
- **Throttler** — 60 req/min default, per-endpoint override (submit/review 20, sync 5, search 30).

### Backend (NestJS 10)

```
backend/src/
├── access/          # IP CIDR + trust user middleware + role assigner
├── audit/           # Audit interceptor + events
├── departments/     # Dept lookup + bootstrap
├── users/           # Upsert + roles + /me endpoint
├── skills/          # Skills registry + versions + load events
│   └── sync/        #   git-mirror + BullMQ sync worker + cron
├── artifacts/       # Report/research/kb CRUD + review + versioning
│   └── templates/   #   Zod schemas + body compiler
├── attachments/     # MinIO proxy upload/download
├── storage/         # MinIO client wrapper
├── webhooks/        # GitLab HMAC → enqueue sync
├── mcp/             # JSON-RPC 2.0 handler + 7 tools
├── search/          # FTS (unaccent + pg_trgm)
├── metrics/         # Prometheus /metrics + middleware
├── health/          # /health + deep /ready
└── db/              # TypeORM datasource + migrations (5 total)
```

### Data
- **Postgres 16** (pgvector image) — 11 tables + migrations. Multi-tenant qua `department_id`. Extensions: pgvector, unaccent, pg_trgm.
- **MinIO** — bucket `onemcp-artifacts` cho file uploads. Bucket auto-create on boot.
- **Redis 7** — BullMQ queue `skill-sync`. `maxmemory-policy=noeviction` (BullMQ requirement).

### Async
- **BullMQ**: `skill-sync` queue processed bởi worker (concurrency 1). Trigger từ webhook OR cron `*/15`.
- **Cron**: skill resync (backup for lost webhook).

## MCP surface

8 tools qua `POST /api/mcp` (JSON-RPC 2.0):

| Tool | Purpose |
|---|---|
| `list_skills` | Enumerate skills khả dụng |
| `load_skill` | Get SKILL.md body of active version |
| `list_artifacts` | Enumerate artifacts (published + own pending) |
| `get_artifact` | Fetch artifact body + metadata |
| `submit_artifact` | Create pending artifact with structured template |
| `get_artifact_template` | Get schema for type (report/research/kb/postmortem/runbook) |
| `search` | FTS across skills + artifacts (unaccent-aware) |
| `load_runbook` | Fetch runbook by ID; logs load event (P7 Alertmanager + CLI tracking) |

## Skills lifecycle

```
Contributor push GitLab ─┬─▶ webhook  ─┐
                         │              │
                         └─▶ cron */15 ─┴─▶ BullMQ sync ─▶ upsert skill_versions (pending)
                                                                  │
                                             Maintainer approve ──┴──▶ currentVersionId → MCP load_skill
```

## Artifact lifecycle

```
Contributor submit ─▶ create artifact + v1 (pending) ─▶ Maintainer review
                                                              │
                                                approve ──▶ currentVersionId, status=published, searchable
                                                              │
                                                reject ────▶ status=rejected/keep-published

Contributor edit ─▶ create v(n+1) (pending, optimistic lock check MAX(version_no))
                                       ▶ Maintainer approve → currentVersionId=v(n+1)
```

## Search

- FTS trên `body_search` generated tsvector column (unaccent + `to_tsvector('simple')`).
- Fuzzy trigram trên title/name via pg_trgm.
- Base rank: `ts_rank_cd × 2 + similarity(title)`.
- **Service boost** (Phase 03): khi có service hint (explicit `?service=` hoặc auto-detect từ `ONEMCP_KNOWN_SERVICES`):
  - +2.0 nếu `type='runbook'` AND `artifact.service = $service` (dedicated column, Phase 02 migration).
  - +1.0 nếu artifact tag khớp service (case-insensitive: `lower(tag) = $service`).
  - +0.5 nếu skill tag khớp service (same lower() check).
  - Boost = 0 khi service = NULL → ranking base không đổi (backward compat).
- Auto-detect: word-boundary regex `\bservice\b` (case-insensitive) — prevents `redis` matching `"redistribute"`. Nếu nhiều services match → không boost (log ambiguity khi `SEARCH_DEBUG=1`).
- Explicit `?service=` validated ngược lại `ONEMCP_KNOWN_SERVICES` allowlist; unknown values silently ignored (không 400).
- Only published artifacts visible cross-user.

## Ops Incident Response (P7 Pilot)

**Feature flag:** `ONEMCP_ENABLE_OPS_TYPES=1` — gates new artifact types (`postmortem`, `runbook`) + Alertmanager webhook + MCP `load_runbook` tool.

### New artifact types
- **`postmortem`**: incident post-mortem template (4 required fields: `summary`, `timeline`, `root_cause`, `action_items`). Stored as artifact, searchable, cross-dept readable.
- **`runbook`**: operational playbook (structure: title, service, mitigation_steps, tags). Dedicated `artifacts.service` column (indexed) for Phase 03 service-boost ranking.

### Alertmanager webhook flow
- **Endpoint:** `POST /api/webhooks/alertmanager` (accepts `Authorization: Bearer {ALERTMANAGER_WEBHOOK_TOKEN}`)
- **Response:** 202 Async — dedup check (Postgres `alertmanager_dedup` table, fingerprint + 4h TTL), search (`SearchService` with `bypassDeptFilter=true`), post Slack `SLACK_ONCALL_WEBHOOK_URL` within 5s timeout.
- **Dedup:** server-side hash of `{alertname + labels}`, prevents duplicate KB posts within 4-hour window.
- **Payload safety:** Slack message sanitizes alert labels (Markdown backticks, escape `@` mentions per RT-6).
- **System actor:** `system-alertmanager` user (created at migration time) handles webhook requests. Bypass dept filter to surface cross-dept runbooks (V2 decision).

### Metrics & audit
- **Runbook load tracking:** `runbook_load_events` table (timestamp, user_id, runbook_id, source='cli'|'slack'|'portal'). TTL + access control TBD Phase 6.2.
- **Metrics:** `onemcp_runbook_loads_total{name}`, `onemcp_alert_matches_total{alertname}`, `onemcp_cli_commands_total{cmd}`.

### Database changes (P7)
- **Migration:** add `artifacts.service` column (VARCHAR 64, nullable, indexed for Phase 03 boost).
- **Table:** `alertmanager_dedup` (fingerprint TEXT PRIMARY KEY, created_at TIMESTAMP, TTL managed via cron DELETE WHERE created_at < NOW() - INTERVAL '4h').
- **Table:** `runbook_load_events` (id, user_id, runbook_id, source, client_ip, created_at; index on user_id, source for auditing).

## Observability

- **Structured logs** (pino JSON). Redact `X-Onemcp-User`, `authorization`, `cookie`.
- **Prometheus /metrics** — HTTP req/duration, artifact submits, skill loads, MCP calls.
- **Health**: `/health` liveness, `/ready` deep check (PG + MinIO).

## Backup

- Daily `backup` container: `pg_dump -Fc -Z 6` + `mc mirror` MinIO → tarball. Bind mount `./backups/<UTC-ts>/`. Retention 14 days.
- Restore: pg_restore + mc mirror ngược.

## Client-side (post-v1 UX guardrail)

- Claude Code MCP config points to `/api/mcp`.
- PreCompact hook `onemcp-wrapup-check.py` — advisory reminder submit artifact.

## Security posture

- **Static-only skills** (C1) — manifest schema hard-limit `permissions=['read']`. Code exec runtime deferred wave 4.
- **Deploy token** (C2) — read-only scope, `oauth2:$TOKEN@` URL rewrite, không log.
- **HMAC webhook** — `X-Gitlab-Token` với `timingSafeEqual`, support plain secret or HMAC-SHA256 hex.
- **Content-Type whitelist** cho attachments (pdf/md/txt/png/jpg/docx). SHA256 checksum verify.
- **Optimistic locking** artifact updates (409 on conflict).
- **Emergency lockdown** env flag → 503 mọi routes trừ `/health`.

## Extension points (v2)

- **Auth**: swap `TrustUserMiddleware` → JWT/OIDC middleware. Downstream code không thay đổi (dùng `req.user`).
- **Semantic search**: pgvector column + embedding worker + hybrid rank.
- **Multi-dept**: schema đã multi-tenant, chỉ cần dept select dropdown UI + role scoping.

## Deployment topology (pilot)

- Single VPS: 4 vCPU / 8 GB / 200 GB (Ubuntu 24.04).
- Postgres: `shared_buffers=512MB` (staging tuning env-configurable).
- All services docker-compose. Nginx expose 80/443 host.
- Backup bind mount → host `./backups/`. Off-site mirror manual (rclone recommend, xem docs/backup-restore.md).

Production tuning (32 GB VPS): PG_SHARED_BUFFERS=4GB, PG_EFFECTIVE_CACHE=12GB, BACKEND_MEM_LIMIT=4g.
