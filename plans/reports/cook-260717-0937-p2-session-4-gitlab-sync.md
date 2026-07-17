# Cook Session 4 — P2 Part 2: GitLab Webhook + Skill Sync Worker

**Date:** 2026-07-17 · **Phase:** P2 Skills Registry · **Progress:** ~75% P2 complete

## Locked decisions (session start)

1. `GITLAB_BASE_URL` = **empty** for now (sync code hoạt động, feature-flag off).
2. Skills layout: **mono-repo** `onemcp/skills-kythuat`, structure `skills/<name>/manifest.json` + `SKILL.md`.
3. Owner mapping: `ownerId = NULL` khi sync, admin gán qua UI sau.

## Delivered — Backend

### New module `skills/sync/`
- `git-mirror.service.ts` — simple-git bare clone (`--mirror`) + fetch + `git show ref:path` + `git log` cho commit sha per skill dir. Auth qua `oauth2:$TOKEN@gitlab.internal` URL rewrite (C2 mitigation).
- `skill-sync.service.ts` — enumerate `ls-tree skills/`, đọc `manifest.json`, validate Zod, upsert Skill + SkillVersion (`status=pending`). Skip nếu commit đã sync.
- `skill-sync.queue.ts` — BullMQ Queue token + `enqueue()` helper (attempts=3, exponential backoff).
- `skill-sync.processor.ts` — WorkerHost, concurrency=1 (single-writer tránh race trên mirror).
- `skill-sync.cron.ts` — `@nestjs/schedule` CronJob dùng `SKILL_SYNC_CRON` (default `*/15 * * * *`). Off nếu `GITLAB_BASE_URL` rỗng.

### New module `webhooks/`
- `gitlab-hmac.guard.ts` — verify `X-Gitlab-Token` support cả **plain secret** (GitLab default) và **HMAC-SHA256 hex** của raw body. `timingSafeEqual` chống timing attack.
- `webhooks.controller.ts` — `POST /api/webhooks/gitlab` → filter `object_kind=push` + `ref=refs/heads/<branch>` + `path_with_namespace=<expected>` → enqueue. Return 202.
- `webhooks.module.ts` — imports SkillsModule để share queue.

### Skills approval
- `skill-approval.service.ts` — `approve()` set version `active` + skill `currentVersionId`; `reject()` mark `rejected`. Role check: maintainer/dept-admin/super-admin. Dept-scoped.
- `skills.controller.ts` bổ sung:
  - `POST /api/skills/:name/versions/:id/approve` (throttle 20/min)
  - `POST /api/skills/:name/versions/:id/reject` (throttle 20/min)
  - `POST /api/skills/sync` — manual trigger (throttle 5/min, maintainer+ only)

### Global wiring
- `app.module.ts` — BullModule.forRootAsync (parse REDIS_URL), ScheduleModule, ThrottlerModule (60/min default) + APP_GUARD ThrottlerGuard.
- `main.ts` — express.json với `verify` callback lưu `req.rawBody` (cần cho HMAC).
- `access/ip-cidr.guard.ts` bypass `/api/webhooks/*` (GitLab egress IP không cố định).
- `access/trust-user.middleware.ts` bypass `/api/webhooks/*` (không có identity header).

### Env schema
`env.schema.ts` thêm: `GITLAB_BASE_URL`, `GITLAB_WEBHOOK_SECRET`, `GITLAB_MIRROR_TOKEN`, `SKILLS_MONO_REPO`, `SKILLS_MONO_BRANCH`, `SKILL_SYNC_CRON`, `SKILL_APPROVE_RATE_LIMIT` (tất cả default an toàn cho dev).

### Deps added
`@nestjs/bullmq`, `@nestjs/schedule`, `@nestjs/throttler`, `bullmq`, `ioredis`, `simple-git`, `cron`.

### Dockerfile
Backend runtime image: `apk add git` + `mkdir /var/lib/onemcp/mirrors` + chown onemcp.

## Delivered — Portal

- `lib/api/skills.ts` bổ sung `approveSkillVersion`, `rejectSkillVersion`, `triggerSkillSync`.
- `app/skills/[name]/page.tsx` — hàng version status=`pending` hiển thị nút **approve** / **reject** (chỉ show nếu maintainer, backend enforce). Refresh sau action.

## Files count
- Backend new: 9 (git-mirror, skill-sync x4, skill-approval, webhooks x3)
- Backend modified: 8 (env schema, Dockerfile, package.json, ip-guard, trust-user, main, app.module, skills.controller, skills.module)
- Portal modified: 2 (skills.ts, [name]/page.tsx)
- Env: 1 (.env.example)
- Total: ~20 files

## Deploy staging

```bash
cd /opt/onemcp
git pull
docker compose build backend portal
docker compose up -d
docker compose logs backend --tail=30
```

Backend boot log kỳ vọng có:
- `SkillSyncCron`: `resync scheduler active — cron="*/15 * * * *"` (nếu `GITLAB_BASE_URL` set) hoặc `GITLAB_BASE_URL empty — skipping resync scheduler`.
- `Bootstrap`: `OneMCP backend listening on :3000 — mode=v1-trust-header`.

## Verify staging (không cần GitLab)

Với `GITLAB_BASE_URL` empty, chỉ verify HTTP surface + throttle + approve flow:

```bash
# 1. Webhook rejected (no secret set OR wrong token)
curl -k -X POST https://onemcp.local/api/webhooks/gitlab \
  -H "Content-Type: application/json" \
  -H "X-Gitlab-Event: Push Hook" \
  -H "X-Gitlab-Token: wrong" \
  -d '{"object_kind":"push"}'
# Expect: 403 Invalid webhook signature

# 2. Manual sync trigger (không được vì user default là contributor)
curl -k -X POST -H "X-Onemcp-User: alice" https://onemcp.local/api/skills/sync
# Expect: 401 "Chỉ maintainer/admin"

# 3. Approve pending version (Version #1 hiện tại là active — sẽ 400)
curl -k -X POST -H "X-Onemcp-User: admin" \
  https://onemcp.local/api/skills/debug-guide/versions/1/approve
# Expect: 200 với version.status='active' (đã active, no-op update)
```

## Portal test

1. Login as `admin` (nếu chưa: mở portal → Identify as → nhập `admin`).
2. `/skills` → `debug-guide` detail.
3. Insert fake pending version qua psql để test UI:
```bash
docker compose exec -T postgres psql -U onemcp onemcp <<'EOF'
INSERT INTO skill_versions (skill_id, "commitSha", version, manifest, status)
VALUES (1, 'pending000', '1.0.1', '{"manifest_version":1,"name":"debug-guide","version":"1.0.1"}'::jsonb, 'pending');
EOF
```
4. Reload page → row mới hiện `approve` / `reject` buttons.
5. Click **approve** → row chuyển `active`, `currentVersionId` update, `approvedAt` fill.

## Enable GitLab (khi sẵn sàng)

Chỉnh `.env`:
```
GITLAB_BASE_URL=https://gitlab.internal
GITLAB_WEBHOOK_SECRET=<random-256bit-hex>
GITLAB_MIRROR_TOKEN=<deploy-token-read_repository>
SKILLS_MONO_REPO=onemcp/skills-kythuat
```

GitLab config Webhooks:
- URL: `https://onemcp.local/api/webhooks/gitlab`
- Secret token: giá trị `GITLAB_WEBHOOK_SECRET`
- Trigger: Push events, branch filter `main`.
- SSL verify: off (self-signed cert lab).

Mono-repo layout:
```
skills-kythuat/
├── skills/
│   ├── debug-guide/
│   │   ├── manifest.json    # SkillManifest (Zod validated)
│   │   └── SKILL.md
│   └── session-wrapup/
│       ├── manifest.json
│       └── SKILL.md
```

`manifest.json`:
```json
{
  "manifest_version": 1,
  "name": "debug-guide",
  "version": "1.0.0",
  "department": "kythuat",
  "description": "Debug production incidents step-by-step",
  "tags": ["debug","incident"],
  "permissions": ["read"]
}
```

## Security mitigations áp dụng session này

- **C1 (skill escalation)**: `permissions` schema hard-enforce `['read']` only. Approve rate-limited 20/min. Manual sync 5/min. Role check maintainer+.
- **C2 (webhook auth)**: HMAC-SHA256 + shared secret via `X-Gitlab-Token`. `timingSafeEqual`. Raw body preserved qua express.json verify hook.
- **C3 (compromised token)**: Deploy token read-only scope. Token stored in `GITLAB_MIRROR_TOKEN` env, không log. URL rewrite ephemeral trước fetch, không persist to disk config.
- **H2 (lost webhook)**: cron `*/15` resync — nếu webhook fail, sync tự phục hồi trong 15 phút.

## Next Session (P2 Part 3: MCP server)

- [ ] `@modelcontextprotocol/sdk` HTTP+SSE transport module
- [ ] MCP access middleware (reuse IP CIDR + trust header)
- [ ] `list_skills` MCP tool
- [ ] `load_skill` MCP tool — `git show <commit_sha>:skills/<name>/SKILL.md` stream
- [ ] Load event logging vào `skill_load_events`
- [ ] E2E test: mock GitLab webhook → sync → MCP load

## Unresolved

- GitLab **egress IPs** cho firewall allow — cần ops team confirm nếu VPS staging chặn ingress từ GitLab.
- Manifest chỉ chấp nhận JSON hiện tại. Nếu team muốn YAML frontmatter trong SKILL.md → cần thêm parser.
- Test cho `git-mirror.service` cần fixture Git repo — chưa viết, sẽ dựng trong P6 hardening.
- `resources[]` trong manifest (file references) chưa kiểm tra tồn tại — sẽ enforce trong CI của skills repo, không phải backend.

## Session Metrics
- Files created: 9 backend + 0 portal
- Files modified: 8 backend + 2 portal + 1 env + 1 compose = 12
- LOC delta: ~600
- New endpoints: 4 (approve, reject, sync trigger, webhook)
- Build status: backend ✅ clean; portal ✅ TS clean (Windows EPERM in .next/standalone — Docker Linux builds unaffected)
