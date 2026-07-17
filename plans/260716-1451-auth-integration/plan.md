---
title: OneMCP — Auth Integration (post-v1)
slug: auth-integration
created: 2026-07-16
status: pending
blockedBy: [260716-1112-onemcp-department-mcp-server]
blocks: []
brainstorm: ../260716-1112-onemcp-department-mcp-server/reports/brainstorm-260716-1112-onemcp-department-mcp-server.md
---

# OneMCP — Auth Integration

**Priority:** Deferred to end of v1 (chốt bởi user).
**Timeframe:** Sau khi P1-P6 của v1 complete.
**Est.:** ~1.5-2 tuần.

## Context

V1 pilot dùng **Mode B**: IP CIDR allowlist + `X-Onemcp-User` trust header.
- Không secure cryptographic, nhưng đủ cho pilot nội bộ.
- Header spoofing accepted risk cho pilot.
- User table schema đã đầy đủ (`inet_sub`, `gitlab_id` NULLABLE) — sẵn sàng populate.

Plan này swap sang auth thật khi pilot ready ra production.

## Objective
Thay trust header identity bằng SSO + JWT thật, không mất data + không break MCP clients.

## Success Metrics
- 100% request qua INET SSO login.
- MCP client auth qua PAT (bearer token).
- Zero data loss trong migration (users hiện có match được với INET profile).
- Rollout không downtime (blue-green hoặc feature flag).

## Phases

### AUTH-P1 — INET SSO integration (~4 ngày)
- Passport OIDC strategy (fallback SAML).
- Login/callback endpoint.
- JWT service + refresh token + Redis blacklist (jti).
- Portal login page.
- Migration: `users.inet_sub` populate khi first-login (match theo email hoặc manual).

### AUTH-P2 — GitLab OAuth linking (~2 ngày)
- Passport GitLab OAuth strategy.
- `/profile → Link GitLab` flow.
- Update `users.gitlab_id`.
- Verify commit author khi submit skill MR.

### AUTH-P3 — RBAC guards + roles (~2 ngày)
- Replace env-based `MAINTAINER_USERNAMES`/`ADMIN_USERNAMES` bằng DB `user_roles` table.
- Admin UI assign role qua portal (super-admin only).
- Existing users giữ role từ env bootstrap → migrate vào DB.

### AUTH-P4 — PAT service (~2 ngày)
- Personal Access Token: issue, revoke, list, last-used tracking.
- Scoped: read-skills, submit-artifacts, ...
- Portal `/tokens` page.
- MCP client migration: swap `X-Onemcp-User` header → `Authorization: Bearer <pat>`.

### AUTH-P5 — Migration & rollout (~2 ngày)
- Feature flag `AUTH_MODE=trust-header | jwt` (env toggle).
- Blue-green: run cả 2 middleware song song, log discrepancies.
- Cutover khi tất cả users login thành công qua INET.
- Remove trust header middleware sau grace period 2 tuần.

### AUTH-P6 — Cleanup (~1 ngày)
- Xóa code trust-user middleware, role-assigner env-based.
- Update docs: security posture upgrade.
- Deprecation notice cho old MCP clients dùng header.

## Prerequisites (blocker)
- ★ INET SSO endpoint + client credentials (OIDC hoặc SAML) — confirmed.
- ★ INET SSO test/staging environment.
- ★ GitLab OAuth app registered.
- ★ V1 pilot chạy ≥30 ngày, feedback tổng hợp.
- Migration script test trên staging.

## Rollout Strategy
1. Deploy code với feature flag OFF → trust header vẫn active.
2. Enable INET login cho 2-3 dev test → verify migration.
3. Enable full → tất cả user phải login SSO.
4. Grace 2 tuần cho MCP clients migrate PAT.
5. Remove trust header code.

## Risk Assessment
- **INET SSO endpoint change** — verify contract stable trước cutover.
- **User mapping fail** — some usernames v1 không match INET email → manual admin fix qua portal.
- **MCP client breakage** — comms trước 2 tuần + migration guide.
- **JWT secret compromise** — rotate qua Redis pub/sub broadcast.

## Security Improvements Delivered
- Cryptographic identity (JWT signature).
- Session revoke (blacklist).
- No more IP-based access (VPN + SSO đủ).
- Audit trail có identity thật (INET sub, không phải claimed username).
- MCP tools scoped permissions per PAT.

## Detailed Phase Files
Viết khi decision gate pass (v1 pilot xong + INET credentials ready).

## Unresolved
- INET SSO OIDC hay SAML cuối cùng?
- Cutover thời điểm — 1 lần hay theo dept?
- Rollback plan nếu SSO integration fail sau cutover?
