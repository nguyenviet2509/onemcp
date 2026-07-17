# Cook Session 1 — P1 Scaffold Handoff

**Date:** 2026-07-16 · **Phase:** P1 Foundation · **Progress:** ~30% P1 complete

## Delivered

### Root
- [README.md](../../../README.md), .gitignore, .editorconfig, .prettierrc.json
- package.json (pnpm workspace 9), pnpm-workspace.yaml
- [.env.example](../../../.env.example) — full env vars for P1-P6
- [docker-compose.yml](../../../docker-compose.yml) — 6 services: postgres/redis/minio/backend/portal/nginx với healthchecks, volumes, network config

### Ops
- [ops/postgres/init.sql](../../../ops/postgres/init.sql) — vector, unaccent, pg_trgm, uuid-ossp + custom text search config `onemcp_vi_en`
- [ops/nginx/onemcp.conf](../../../ops/nginx/onemcp.conf) — TLS termination, real IP forwarding, rate limit per (IP + username), SSE proxy config
- [ops/nginx/generate-self-signed-tls.sh](../../../ops/nginx/generate-self-signed-tls.sh) — dev cert script

### Backend (NestJS)
- package.json, tsconfig.json, nest-cli.json, Dockerfile, .dockerignore
- src/config/env.schema.ts — Zod validation fail-fast at boot
- src/main.ts — bootstrap + pino logger + fail-fast env
- src/app.module.ts — root module (Config + Logger + Health)
- src/health/{health.module.ts,health.controller.ts} — /health + /ready endpoints, EMERGENCY_LOCKDOWN gate

### Portal (Next.js 15)
- package.json, tsconfig.json, next.config.mjs (standalone output), tailwind.config.ts, postcss.config.mjs, Dockerfile, .dockerignore
- app/{layout.tsx,page.tsx,globals.css} — root layout + minimal home
- app/health/route.ts — liveness route for docker healthcheck

## Directory tree
```
onemcp/
├── README.md, .gitignore, .editorconfig, .prettierrc.json
├── package.json, pnpm-workspace.yaml
├── docker-compose.yml, .env.example
├── backend/
│   ├── package.json, tsconfig.json, nest-cli.json, Dockerfile, .dockerignore
│   └── src/{main.ts, app.module.ts, config/env.schema.ts, health/*}
├── portal/
│   ├── package.json, tsconfig.json, next.config.mjs, tailwind.config.ts,
│   │   postcss.config.mjs, Dockerfile, .dockerignore
│   ├── app/{layout.tsx, page.tsx, globals.css, health/route.ts}
│   └── public/.gitkeep
├── ops/
│   ├── postgres/init.sql
│   ├── nginx/{onemcp.conf, generate-self-signed-tls.sh}
│   └── minio/ (empty)
├── docs/development-roadmap.md
└── plans/ (v1 + wave2-5 + auth-integration)
```

## Verification (chưa chạy — cần dev machine)
```bash
# 1. pnpm install workspace
cd d:\Vietnt\Project\onemcp
pnpm install

# 2. Generate self-signed TLS
bash ops/nginx/generate-self-signed-tls.sh onemcp.internal

# 3. Copy env
copy .env.example .env

# 4. Boot stack
docker compose up -d

# 5. Verify
curl -k https://localhost/api/health   # backend
curl -k https://localhost/health       # portal
curl -k https://localhost/             # home
```

## Next Session (P1 Step 4-11)

Còn lại của P1 (~70%):

### P1 step 4-8 — DB + Access Control (core P1)
- [ ] DB schema init migration — departments, users, roles, user_roles, audit_events tables (multi-tenant với `department_id NOT NULL`, users.inet_sub/gitlab_id NULLABLE)
- [ ] Seed 1 dept `kythuat` + 5 roles (viewer/contributor/maintainer/dept-admin/super-admin)
- [ ] TypeORM DataSource + migration:run script
- [ ] `access/` module: IpCidrGuard (parse CIDR from env), TrustUserMiddleware (upsert user, parse X-Onemcp-User), RoleAssignerService (env-based mapping), @CurrentUser() decorator
- [ ] AdminCidrGuard riêng cho /admin/* routes (C3 red-team mitigation)
- [ ] Role sanity check: reject impersonation attempt admin/maintainer từ non-admin CIDR
- [ ] users.status field + disabled check (C4)

### P1 step 9-11 — Audit + Portal + Nginx
- [ ] Audit interceptor global + audit_events entity, async insert
- [ ] Rate limit approve action (C1)
- [ ] Portal: "Identify as" dropdown (localStorage) + axios interceptor inject header
- [ ] Portal navbar + profile page (call GET /me)
- [ ] Nginx cert deploy step

### P1 step 12-13 — Tests + Docs
- [ ] E2E tests 5 scenarios: (a) OK; (b) ngoài CIDR → 403; (c) thiếu header → 400; (d) admin từ non-admin CIDR → 403; (e) lockdown → 503
- [ ] Migration up→down→up CI check (H5 mitigation)
- [ ] docs/system-architecture.md sketch
- [ ] docs/code-standards.md

## Unresolved (blocking full P1)
- **IP CIDR list production actual** — validation chốt `USER_ALLOW_CIDR=10.0.14.0/24`, `ADMIN_ALLOW_CIDR=192.168.122.0/24`. Confirm với IT infra trước deploy VPS.
- **VPS provisioned chưa** — production 8vCPU/32GB/1TB + staging 4vCPU/8GB/200GB.
- **GitLab admin access** — cần cho P2 kickoff.
- **External S3 backup destination** — cần cho P6.

## Notes
- Không có auth module trong scaffold — v1 dùng IP + trust header (mode B locked).
- ONNX embedding model chưa fetch — script sẽ viết ở P4 (`scripts/fetch-embedding-model.sh`).
- 4 findings từ red-team review chưa apply code (C1/C3/C4 + rate limit) — sẽ implement trong Access module + Audit module ở next session.
- Ubuntu 24.04 stack: đã test compose config compile OK trên Windows dev (cần verify trên VPS actual).

## Session Metrics
- 24 files created (~1200 LOC config + boilerplate).
- Backend + portal đủ để `docker compose up` (chưa `pnpm install` trên host, chưa test image build).
- Todo P1 remaining: ~15 items.
