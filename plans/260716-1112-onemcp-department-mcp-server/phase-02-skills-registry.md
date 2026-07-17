# Phase 02 — Skills Registry

**Priority:** High
**Status:** pending
**Est.:** 1.5 tuần (giảm do bỏ PAT, dùng trust header từ P1)
**Depends on:** P1 (IP CIDR, trust user, audit)

> **Auth defer note:** v1 dùng IP CIDR + `X-Onemcp-User` header (mode B). Bỏ PAT service khỏi P2. Auth thật (JWT + PAT scoped) sẽ thêm ở plan `260716-1451-auth-integration` sau v1.

> **Static-only skills v1 (chốt validation):** Skills chỉ chứa SKILL.md + resources (text files, images). MCP server KHÔNG execute code từ skill. Manifest KHÔNG có `permissions: [execute]` field ở v1. Sandbox execution defer Wave 4. (C1 mitigation)

## Overview
Đăng ký skills qua GitLab repo + DB metadata. MR review + CI validate → webhook sync vào registry. MCP HTTP+SSE server expose `list_skills`, `load_skill`.

## Key Insights
- **Hybrid**: source-of-truth code ở GitLab, metadata + version pointer ở DB.
- Skill hiện chỉ static (SKILL.md + resources), **không execute code trong server** ở v1 → giảm rủi ro sandbox.
- Local git mirror cho phép load nhanh không phụ thuộc GitLab uptime.

## Requirements

### Functional
- MR trong `gitlab/onemcp/skills-<dept>` với folder `skills/<name>/manifest.yaml` + `SKILL.md` + optional `resources/`.
- CI pipeline validate manifest schema + secret scan (gitleaks) + dangerous-import check (regex list configurable).
- GitLab webhook on merge → backend endpoint `/webhooks/gitlab` → verify HMAC → git fetch mirror → parse manifest → upsert `skill_versions`.
- MCP tools:
  - `list_skills(dept?, tag?)` → RBAC filter → return list.
  - `load_skill(name, version?)` → checkout commit → stream SKILL.md + resources.
- Portal: skills browse page (search, filter by tag, view manifest, history).

### Non-Functional
- Webhook idempotent (retry-safe).
- Load latency < 300ms (từ local mirror).
- Manifest schema versioned.

## Architecture

```
[GitLab Repo] ──MR merge──► [Webhook] ──► /webhooks/gitlab
                                              │
                              [Verify HMAC + queue job]
                                              │
                                     [SkillSyncWorker]
                                              │
                          git fetch mirror ──► parse manifest.yaml
                                              │
                              upsert skill + skill_versions
                                              │
                                        audit_events
                                              │
                        [MCP HTTP+SSE Server] ──list_skills──► RBAC filter
                                              └──load_skill──► checkout commit → stream
```

## Related Code Files (to create/modify)

### backend/
```
src/skills/
├── skills.module.ts
├── entities/skill.entity.ts
├── entities/skill-version.entity.ts
├── entities/skill-load-event.entity.ts
├── skills.service.ts
├── skills.controller.ts                        # REST for portal
├── manifest-schema.ts                          # Zod
├── manifest-validator.ts
├── git-mirror.service.ts                       # simple-git wrapper
├── webhook.controller.ts                       # /webhooks/gitlab
└── webhook-verifier.ts

src/mcp/
├── mcp.module.ts
├── mcp-server.ts                               # @modelcontextprotocol/sdk
├── mcp-http-sse.gateway.ts                     # streamable HTTP
├── mcp-access.middleware.ts                    # v1: IP CIDR + X-Onemcp-User (reuse P1 middlewares)
├── tools/list-skills.tool.ts
└── tools/load-skill.tool.ts
# PAT service defer sang plan auth-integration

src/queue/
├── queue.module.ts
├── bullmq-config.ts
└── workers/skill-sync.worker.ts

src/db/migrations/1720100000000-skills.ts
```

### GitLab side (docs only, config lives in GitLab)
```
gitlab-ci-template/
├── .gitlab-ci.yml.example                     # for skills repos
├── validate-manifest.sh
└── scan-secrets.sh
```

### portal/
```
app/skills/
├── page.tsx                                    # list + filter
└── [name]/page.tsx                             # detail + versions
# tokens/page.tsx defer sang auth-integration plan

lib/api/skills.ts
```

## Implementation Steps

1. **DB migration** — skills, skill_versions, skill_load_events, personal_access_tokens.
2. **Manifest schema** — Zod: `name, version, dept, tags[], description, entrypoint (SKILL.md path), resources[], permissions[]`.
3. **Manifest validator + CI scripts** — bash scripts publish trong `gitlab-ci-template/`. Skills repo consume via `include`.
4. **Git mirror service** — clone bare repo lần đầu, fetch on webhook. Config `MIRROR_ROOT=/var/lib/onemcp/mirrors`.
5. **Webhook endpoint** — verify `X-Gitlab-Token` HMAC, parse payload, enqueue sync job.
6. **Skill sync worker** — BullMQ consumer: `git fetch` → diff manifests → upsert. Idempotent qua `(skill_id, commit_sha)` unique.
7. **REST controller** — GET /skills, GET /skills/:name, GET /skills/:name/versions. RBAC guard.
8. **PAT service** — issue token qua portal, scope claims, bcrypt hash lưu DB, hiển thị plaintext 1 lần.
9. **MCP server module** — dùng `@modelcontextprotocol/sdk`, transport HTTP+SSE. Middleware verify bearer PAT → set request user.
10. **MCP tool `list_skills`** — call SkillsService với dept filter theo user.
11. **MCP tool `load_skill`** — resolve version (default: current), git show file content, return SKILL.md + resources map. Log load event.
12. **Portal skills page** — list + search + filter + version history modal.
13. **Portal PAT page** — issue/revoke/list tokens + last-used timestamp.
14. **E2E** — mock GitLab webhook → assert skill visible via REST + MCP → assert load returns content + audit ghi.

## Todo
- [ ] Skills migration
- [ ] Manifest Zod schema + tests
- [ ] CI validate + secret scan scripts
- [ ] Git mirror service (simple-git)
- [ ] Webhook controller + HMAC verify
- [ ] BullMQ skill-sync worker
- [ ] Skills REST controller + service
- [ ] ~~PAT service + controller + entity~~ (defer sang auth-integration plan)
- [ ] MCP server module + HTTP+SSE gateway
- [ ] MCP access middleware (reuse IpCidrGuard + TrustUserMiddleware từ P1)
- [ ] list_skills MCP tool
- [ ] load_skill MCP tool + load event logging
- [ ] Portal skills list/detail pages
- [ ] ~~Portal PAT management page~~ (defer)
- [ ] E2E webhook → load flow
- [ ] Compile check
- [ ] Docs update: skills authoring guide in docs/

## Success Criteria
- Push skill qua MR → merge → xuất hiện trong portal + MCP `list_skills` trong < 30s.
- `load_skill` trả về đúng content của commit đã approve.
- Skill từ dept khác không visible cho user không có role dept đó.
- Skill load ghi vào `skill_load_events` + `audit_events`.

## Risk Assessment
- **Webhook flakiness** → cron fallback re-sync mỗi 15 phút.
- **Manifest breaking changes** → schema versioning field, backend hỗ trợ N-1.
- **Git mirror disk growth** → shallow clone + prune untracked; monitor disk usage.
- **PAT leak** → scoped tokens + rotation policy + last-used tracking + portal revoke.

## Security Considerations — Red-Team Mitigations
- Webhook HMAC bắt buộc, reject nếu sai.
- **GitLab clone credentials:** Dùng Deploy Token riêng per skills repo (scope: read_repository). Store trong Docker secret, không plain env (C2 mitigation).
- **Rotate Deploy Token** định kỳ (quarterly + on-demand).
- Skill manifest **KHÔNG cho phép** field `permissions.execute` ở v1. Manifest validator reject nếu có (C1).
- Skill load response không expose absolute path filesystem.
- **Approve rate limit:** max 5 skill_publish per user per hour (C1).
- **Portal skills detail page:** không hiển thị commit author + reviewer to non-maintainer (C1).
- MCP rate limit theo (IP + username).
- **Fallback resync cron:** mỗi 15 phút compare skill_versions DB vs git log, alert nếu drift (H7 mitigation).

## Next Steps
- P3 (Artifacts) chạy song song được sau khi MCP server module + PAT có mặt.
- Cần confirm GitLab CI runner available trong self-host trước khi kết thúc phase.
