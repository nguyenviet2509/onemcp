# Phase 01 — Foundation

**Priority:** Critical (blocker cho tất cả phase sau)
**Status:** pending
**Est.:** 1.5 tuần (giảm từ 2w do defer auth)

## Overview
Dựng infra baseline, **IP CIDR allowlist + trust header identity** (auth đầy đủ defer sang plan riêng sau v1), schema đa tenant-ready, portal skeleton, audit logger.

## Auth Deferral Note
Full auth (INET SSO + GitLab OAuth + JWT + RBAC guards) **defer sang plan riêng** [260716-1451-auth-integration](../260716-1451-auth-integration/plan.md), sẽ cook sau khi P1-P6 xong.

V1 dùng **Mode B — IP CIDR allowlist + trust header identity**:
- `IpCidrGuard` — parse env `USER_ALLOW_CIDR` / `ADMIN_ALLOW_CIDR`, reject IP ngoài dải.
- `TrustUserMiddleware` — đọc `X-Onemcp-User` header (client tự khai), upsert user, gán role theo env config, attach `req.user`.
- Users table schema giữ đủ field (inet_sub, gitlab_id nullable) — sẵn sàng populate khi auth ready.
- Portal có "Identify as" dropdown ở navbar (localStorage, gửi header với mọi request).

Không cryptographic security nhưng đủ cho pilot Kỹ thuật nội bộ + giữ **KB attribution** cho use case chính.

## Key Insights
- Multi-tenant schema từ đầu (department_id NOT NULL) — tránh retrofit sau.
- Audit middleware phải chạy trước business logic → wrap ở app-level interceptor.
- User table + role table schema đầy đủ ngay v1 → auth phase sau chỉ swap middleware, không migrate data.
- Trust header là honor system — pilot nội bộ chấp nhận được, không dùng ngoài.

## Requirements

### Functional
- Docker Compose stack: Postgres 16 (pgvector, unaccent, pg_trgm), Redis, MinIO, backend, portal, nginx.
- **IP CIDR allowlist** middleware — reject 403 nếu client IP không match `USER_ALLOW_CIDR`.
- **Trust user middleware** — parse `X-Onemcp-User`, upsert user (username là identity), assign role.
- Role bootstrap qua env: `MAINTAINER_USERNAMES=alice,bob`, `ADMIN_USERNAMES=admin`, default = `contributor`.
- Portal skeleton: layout, "Identify as" dropdown (localStorage), profile page, health check.
- Audit log mọi mutation với `actor = { username, ip }`.

### Non-Functional
- HTTPS everywhere (self-signed OK internal).
- Config qua env vars, không hardcode.
- IP allowlist evaluate nhanh (< 1ms), cache parsed CIDR.

## Architecture

```
[Browser] ─► [Nginx TLS] ─► [Next.js Portal] ─► [NestJS Backend]
                                                        │
   ┌────────────────────────────────────────────────────┤
   │ IpCidrGuard          — check remote IP vs USER_ALLOW_CIDR
   │ TrustUserMiddleware  — parse X-Onemcp-User, upsert user
   │ RoleAssignerService  — map username → role from env
   │ AuditModule          — interceptor → audit_events (actor)
   │ UsersModule / DepartmentsModule
   └────────────────────────────────────────────────────┘
                            │
                    [PostgreSQL 16]
```

## Related Code Files (to create)

```
docker-compose.yml
.env.example
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/env.schema.ts                       # Zod env validation
│   ├── access/                                    # v1 IP + trust header (defer real auth)
│   │   ├── access.module.ts
│   │   ├── ip-cidr.guard.ts                       # parse CIDR, check client IP
│   │   ├── cidr-parser.ts                         # ip-cidr helper
│   │   ├── trust-user.middleware.ts               # X-Onemcp-User → upsert + attach req.user
│   │   ├── role-assigner.service.ts               # username → role from env lists
│   │   └── current-user.decorator.ts              # @CurrentUser() param
│   ├── audit/
│   │   ├── audit.module.ts
│   │   ├── audit-log.service.ts
│   │   ├── audit.interceptor.ts                   # global, actor from req.user
│   │   └── entities/audit-event.entity.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts                       # upsertByUsername()
│   │   ├── entities/user.entity.ts                # inet_sub + gitlab_id NULLABLE
│   │   └── entities/role.entity.ts
│   ├── departments/
│   │   ├── departments.module.ts
│   │   └── entities/department.entity.ts
│   ├── db/
│   │   ├── data-source.ts                         # TypeORM
│   │   └── migrations/1720000000000-init.ts
│   └── common/
│       ├── logger.ts                              # Pino
│       └── correlation-id.middleware.ts
├── test/
│   ├── ip-cidr.spec.ts
│   ├── trust-user.spec.ts
│   └── audit.e2e-spec.ts
├── package.json
├── tsconfig.json
└── Dockerfile

portal/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── profile/page.tsx                           # show current identify
│   └── health/page.tsx
├── components/
│   ├── nav.tsx
│   ├── identify-as-dropdown.tsx                   # localStorage username + header injector
│   └── ui/                                        # shadcn generated
├── lib/
│   ├── identity.ts                                # localStorage read/write
│   └── api-client.ts                              # auto-inject X-Onemcp-User
├── package.json
├── tsconfig.json
└── Dockerfile

ops/
├── postgres/init.sql                              # extensions: pgvector, unaccent, pg_trgm
├── minio/policy.json
└── nginx/onemcp.conf                              # reverse proxy + forward real IP header
```

## Env Template (.env.example)
```env
# Access control (v1 — defer full auth) — chốt từ validation
USER_ALLOW_CIDR=10.0.14.0/24
ADMIN_ALLOW_CIDR=192.168.122.0/24
TRUST_USER_HEADER=X-Onemcp-User
DEFAULT_ROLE=contributor
MAINTAINER_USERNAMES=alice,bob
ADMIN_USERNAMES=admin

# Nginx trust real IP
TRUSTED_PROXY_CIDR=127.0.0.1/32

# Infra
POSTGRES_URL=postgres://onemcp:secret@postgres:5432/onemcp
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=onemcp
MINIO_SECRET_KEY=changeme
```

## Implementation Steps

1. **Repo scaffold** — pnpm workspace, `backend/`, `portal/`, `ops/`. Root `README.md`, `.editorconfig`, `.gitignore`.
2. **Docker Compose** — postgres (init.sql extensions), redis, minio, backend, portal, nginx. Named volumes. Healthchecks.
3. **Backend bootstrap** — NestJS CLI init. TypeORM, Zod env validation, Pino logger.
4. **DB schema init migration** — tables: departments, users (inet_sub/gitlab_id NULLABLE), roles, user_roles, audit_events. Seed 1 dept "kythuat", 5 roles.
5. **CidrParser + IpCidrGuard** — parse env `USER_ALLOW_CIDR` `ADMIN_ALLOW_CIDR` once at bootstrap, evaluate O(n) per request (n nhỏ). Extract client IP từ `X-Forwarded-For` (trust proxy CIDR).
6. **TrustUserMiddleware** — header `X-Onemcp-User` required (reject 400 nếu thiếu); upsert user by username; RoleAssignerService assign role theo env list; attach `req.user`.
7. **@CurrentUser() decorator** — param decorator lấy `req.user` cho controllers.
8. **Audit interceptor** — global, log mọi POST/PUT/PATCH/DELETE với `actor = { user_id, username, ip }`. Async insert.
9. **Users + Departments modules** — CRUD read-only cho v1 (users tự upsert qua middleware).
10. **Portal skeleton** — Next.js app router, shadcn init. "Identify as" dropdown ở navbar: input username → save localStorage → axios interceptor gửi header.
11. **Portal profile page** — hiển thị current username + role được assign (call backend GET /me).
12. **Nginx reverse proxy** — `set_real_ip_from`, `real_ip_header X-Forwarded-For`. TLS termination.
13. **E2E test** — 3 scenario: (a) IP ngoài CIDR → 403; (b) IP OK, missing header → 400; (c) IP OK + header → 200 + user created + audit ghi.
14. **Docs** — `docs/system-architecture.md` sketch note "v1 dùng IP+trust header, auth phase riêng post-v1"; `docs/code-standards.md`.

## Todo
- [ ] Repo scaffold + pnpm workspace
- [ ] Docker Compose stack + healthchecks
- [ ] Postgres init.sql (extensions)
- [ ] NestJS bootstrap + env validation
- [ ] TypeORM data source + init migration
- [ ] Seed departments + roles
- [ ] CIDR parser + IpCidrGuard
- [ ] TrustUserMiddleware + upsert
- [ ] RoleAssignerService (env-based mapping)
- [ ] @CurrentUser() decorator
- [ ] Audit interceptor + service
- [ ] Users + Departments modules
- [ ] Next.js portal init + shadcn
- [ ] "Identify as" dropdown + localStorage
- [ ] Portal profile + navbar
- [ ] Axios interceptor inject header
- [ ] Nginx reverse proxy + real IP forwarding
- [ ] AdminCidrGuard riêng cho /admin/* routes (C3 mitigation)
- [ ] Role sanity check: reject claim admin/maintainer từ non-admin CIDR (C1/C3)
- [ ] Emergency lockdown env flag (C4)
- [ ] Users status field + disabled check (C4)
- [ ] Rate limit approve action (C1)
- [ ] Portal profile không expose maintainer list (C1)
- [ ] E2E tests (5 scenarios: OK, ngoài CIDR, thiếu header, admin từ non-admin CIDR reject, lockdown)
- [ ] Compile check
- [ ] Initial docs

## Success Criteria
- `docker-compose up` cho full stack healthy.
- Request từ IP ngoài `USER_ALLOW_CIDR` → 403.
- Request thiếu `X-Onemcp-User` → 400.
- Request đủ điều kiện → 200, user upsert, audit event ghi với đúng actor.
- Username trong `MAINTAINER_USERNAMES` được assign role maintainer.
- Portal "Identify as" flow round-trip: nhập username → save → mọi request gửi header đúng.

## Risk Assessment
- **Header spoofing** — bất kỳ ai trong CIDR đều spoof được identity. **Accepted risk** cho pilot nội bộ; auth phase sẽ giải quyết.
- **CIDR misconfiguration** — sai dải IP → lock out. **Mitigation:** ADMIN_ALLOW_CIDR luôn bao gồm localhost + admin static IP; env validation reject empty.
- **User table pollution** — dev typo username → tạo user rác. **Mitigation:** normalize (lowercase, trim, regex `^[a-z0-9._-]{2,32}$`), reject invalid.
- **Migration khi auth ready** — user cũ có `username` nhưng chưa có `inet_sub`. **Mitigation:** auth plan sẽ có step matching username với INET profile.

## Security Considerations (v1) — Red-Team Mitigations
- CIDR check chạy TRƯỚC mọi middleware khác.
- **Nginx set `X-Real-IP` từ trusted proxy, backend KHÔNG tin IP từ header client** (C3 mitigation).
- **AdminCidrGuard riêng biệt** enforce trên `/admin/*` routes — strict `ADMIN_ALLOW_CIDR`. Portal Next.js middleware duplicate check (defense in depth) (C3).
- **Trust header + role sanity check:** user claim `admin`/`maintainer` từ IP không phải `ADMIN_ALLOW_CIDR` → 403 + audit event `impersonation_attempt` (C1, C3).
- **Rate limit approve action:** max 5 approve/hour per user (C1).
- **Portal profile page KHÔNG expose danh sách maintainer/admin** cho user thường (C1).
- **Emergency lockdown flag:** env `EMERGENCY_LOCKDOWN=true` → mọi request 503 trừ `/health`. Runbook 30-phút (C4).
- **User status field:** `users.status` (`active` / `disabled`). TrustUserMiddleware reject nếu `disabled`. Admin có thể "revoke" user không cần auth thật (C4).
- Rate limit theo (IP + username) từ trust header, không chỉ IP.
- HTTPS bắt buộc dù internal (self-signed cert OK).
- **KHÔNG** expose OneMCP ra Internet (VPN-only).
- Log flag rõ v1 mode = "trust-header" trong healthcheck để ops biết security posture.

## Next Steps
- P2 depends on: users, departments, audit, IpCidrGuard ready.
- Auth full integration = plan `260716-1451-auth-integration` — cook sau P6.
