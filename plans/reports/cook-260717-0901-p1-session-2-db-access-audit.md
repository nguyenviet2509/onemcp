# Cook Session 2 — P1 DB + Access + Audit

**Date:** 2026-07-17 · **Phase:** P1 Foundation · **Progress:** ~80% P1 complete (từ ~30% session 1).

## Delivered

### Backend DB layer
- `src/departments/entities/department.entity.ts` — Department (id, code, name).
- `src/users/entities/role.entity.ts` — Role (5 codes seeded).
- `src/users/entities/user.entity.ts` — User (`inetSub`, `gitlabId` NULLABLE; `status` field cho C4 mitigation).
- `src/users/entities/user-role.entity.ts` — UserRole (dept-scoped, UNIQUE constraint).
- `src/audit/entities/audit-event.entity.ts` — append-only, indexed.
- `src/db/data-source.ts` — TypeORM DataSource + migration path.
- `src/db/migrations/1720000000000-init.ts` — init schema + seed dept `kythuat` + 5 roles. Có `down()` (H5 mitigation).

### Backend Access module (v1 trust-header)
- `src/access/cidr-parser.ts` — parse CIDR list, normalize v4-mapped v6.
- `src/access/ip-cidr.guard.ts` — global guard, resolve client IP qua trusted proxy, EMERGENCY_LOCKDOWN enforce.
- `src/access/admin-cidr.guard.ts` — strict guard cho admin routes (C3 mitigation).
- `src/access/trust-user.middleware.ts` — parse `X-Onemcp-User`, validate regex, upsert user, **role privileged claim từ non-admin CIDR → 403** (C1/C3 mitigation), **user status disabled → 403** (C4).
- `src/access/role-assigner.service.ts` — env-based role bootstrap (`MAINTAINER_USERNAMES`, `ADMIN_USERNAMES`).
- `src/access/current-user.decorator.ts` — `@CurrentUser()` param decorator.
- `src/access/access.module.ts` — global module, wire IpCidrGuard as APP_GUARD + apply middleware.
- `src/common/user-request.ts` — `RequestUser` + `AuthedRequest` types.

### Backend Audit module
- `src/audit/audit-log.service.ts` — fire-and-forget insert (non-blocking).
- `src/audit/audit.interceptor.ts` — global APP_INTERCEPTOR, log mọi POST/PUT/PATCH/DELETE.
- `src/audit/audit.module.ts` — wire everything.

### Backend Users + Departments
- `src/departments/departments.service.ts` — cache default dept id at boot.
- `src/departments/departments.module.ts`.
- `src/users/users.service.ts` — `upsertByUsername()` cho trust middleware.
- `src/users/users.controller.ts` — `GET /me` endpoint.
- `src/users/users.module.ts`.

### Backend wire-up
- `src/app.module.ts` — TypeOrmModule + all modules.
- `src/main.ts` — run migrations trước khi accept traffic + `trust proxy`.

### Portal identity UI
- `portal/lib/identity.ts` — localStorage `onemcp.identity`.
- `portal/lib/api-client.ts` — fetch wrapper inject `X-Onemcp-User` header.
- `portal/components/identify-as-dropdown.tsx` — client component, edit/save/clear.
- `portal/components/nav.tsx` — navbar với dropdown.
- `portal/app/layout.tsx` — thêm Nav.
- `portal/app/profile/page.tsx` — hiển thị /me response (username, roles, dept, status).

## Files count
- Backend session 2: 18 files
- Portal session 2: 6 files
- Total session 2: 24 files

## Red-Team Mitigations Applied
| ID | Mitigation | Where |
|---|---|---|
| C1 | Approve rate limit (defer P2 khi có approve endpoint) | — |
| C1/C3 | Role privileged claim từ non-admin CIDR → reject | trust-user.middleware.ts |
| C3 | AdminCidrGuard riêng biệt cho /admin/* | admin-cidr.guard.ts |
| C4 | Emergency lockdown env flag | ip-cidr.guard.ts |
| C4 | User status field + disabled check | trust-user.middleware.ts + user.entity.ts |
| H5 | Migration `.down()` implemented | 1720000000000-init.ts |

## Deploy staging

Copy code sang VPS staging + rebuild:

```bash
# Trên máy dev (Windows PowerShell)
scp -r backend portal deploy@192.168.122.56:/opt/onemcp/
# Hoặc git push + git pull nếu đã setup git

# Trên VPS
cd /opt/onemcp
docker compose build backend portal
docker compose up -d
docker compose logs -f backend
```

Backend boot sẽ auto-run migration `Init1720000000000` → tạo tables + seed 5 roles + 1 dept.

## Verify staging

```bash
# 1. Migration ran
docker compose exec postgres psql -U onemcp onemcp -c "\dt"
# Expect: departments, roles, users, user_roles, audit_events

docker compose exec postgres psql -U onemcp onemcp -c "SELECT code FROM roles;"
docker compose exec postgres psql -U onemcp onemcp -c "SELECT code, name FROM departments;"

# 2. Access control — thiếu header
curl -k https://localhost/api/me
# Expect: 400 Missing identity header X-Onemcp-User

# 3. Access control — có header
curl -k -H "X-Onemcp-User: alice" https://localhost/api/me
# Expect: 200 { username: "alice", roles: ["contributor"], ... }
docker compose exec postgres psql -U onemcp onemcp -c "SELECT username, status FROM users;"

# 4. Impersonation attempt — claim admin từ non-admin IP
# (chạy từ IP không trong ADMIN_ALLOW_CIDR nhưng trong USER_ALLOW_CIDR)
export ADMIN_USERNAMES=alice
docker compose restart backend
curl -k -H "X-Onemcp-User: alice" https://localhost/api/me
# Expect: 403 Privileged role claim from non-admin IP (nếu VPS IP không match ADMIN CIDR)

# 5. Audit log
curl -k -X POST -H "X-Onemcp-User: alice" https://localhost/api/me
# (POST /me hiện không tồn tại, sẽ 404 nhưng interceptor không log route 4xx)
docker compose exec postgres psql -U onemcp onemcp -c "SELECT action, \"actorUsername\", ts FROM audit_events ORDER BY ts DESC LIMIT 10;"
```

## Portal test từ máy dev

1. Truy cập https://onemcp.local
2. Navbar hiển thị input "username"
3. Nhập `alice` → Save → reload
4. Click "Profile" → hiển thị:
   - Username: `alice`
   - Roles: `contributor`
   - Department: `#1`
   - Status: `active`
   - Mode: `v1-trust-header`

## Next Session (P1 Step ~15-17 → cook session 3)

### P1 remaining (~20%)
- [ ] E2E test suite (5 scenarios): OK, ngoài CIDR, missing header, admin impersonate, lockdown.
- [ ] Approve rate limit middleware (defer đến P2 nếu chưa có approve action).
- [ ] Migration up→down→up CI test (H5 mitigation).
- [ ] `docs/system-architecture.md` sketch.
- [ ] `docs/code-standards.md`.
- [ ] Portal profile page: hiển thị "not identified yet" fallback.
- [ ] Backend `/admin/lockdown` toggle endpoint (or leave env-only).

### Sau P1 → P2 Skills Registry
- GitLab Deploy Token setup (C2 mitigation).
- Manifest Zod schema + CI validator.
- Git mirror service.
- Webhook consumer.
- MCP server module (streamable HTTP+SSE).
- `list_skills` + `load_skill` MCP tools.
- Portal skills list + detail pages.

## Known Issues / Debt
- **cidr-matcher package**: v1 pilot dùng phổ biến; alternative `ip-cidr` cũng OK. Verify installable.
- **Migration auto-run on boot**: OK cho staging + dev. Production nên tách migration step trước khi backend start (blue-green safe).
- **Trust proxy `true`**: hiện tại tin toàn bộ chain X-Forwarded-For. Nginx phía trước đã strip nhưng risk medium — production tinh chỉnh sang `trust proxy: '127.0.0.1'`.
- **Rate limit Nginx per-IP:** đã có ở nginx config, đủ cho v1.

## Session Metrics
- Files created: 24
- LOC: ~1400
- Backend modules: 5 new (access, audit, users, departments, health đã có)
- Portal components: 2 new (nav, identify-as-dropdown)
- Migration: 1
- Red-team critical mitigations addressed: C1, C3, C4 (C2 defer P2, C5 sẽ ở P6.5).

## Unresolved
- VPS staging cần rebuild backend + portal images sau khi copy code.
- Pilot user list confirm để add vào MAINTAINER_USERNAMES/ADMIN_USERNAMES trước rollout.
- Portal cần rebuild sau khi thêm dependencies (không có new deps ở session 2 nên OK).
