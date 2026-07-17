# Cook Session 3 — P2 Part 1: Skills Schema + REST + Portal

**Date:** 2026-07-17 · **Phase:** P2 Skills Registry · **Progress:** ~40% P2 complete

## Delivered

### Backend
- `src/skills/entities/skill.entity.ts` — Skill (multi-tenant, unique per dept+name, tags array).
- `src/skills/entities/skill-version.entity.ts` — SkillVersion (commit_sha unique per skill, jsonb manifest).
- `src/skills/entities/skill-load-event.entity.ts` — Load audit trail cho MCP `load_skill` (P2 part 3).
- `src/db/migrations/1720100000000-skills.ts` — 3 tables + GIN index tags + FK circular skills.currentVersionId. Có `.down()`.
- `src/skills/manifest-schema.ts` — Zod schema, **`permissions` chỉ `read`** (C1 mitigation), manifest_version max check.
- `src/skills/manifest-validator.ts` — `validate()` + `validateOrThrow()` cho use từ webhook/CI.
- `src/skills/skills.service.ts` — list (dept-scoped + tag/q filter), findByName, listVersions, findCurrentVersion, recordLoadEvent.
- `src/skills/skills.controller.ts` — `GET /api/skills`, `GET /api/skills/:name`, `GET /api/skills/:name/versions`.
- `src/skills/skills.module.ts` — wire lên AppModule.

### Portal
- `portal/lib/api/skills.ts` — typed client (listSkills, getSkill, listSkillVersions).
- `portal/app/skills/page.tsx` — list + search + tag filter, empty state hint.
- `portal/app/skills/[name]/page.tsx` — detail + repo link + version history table (current version highlight).
- `portal/components/nav.tsx` — thêm link "Skills".

## Files count
- Backend: 8 files
- Portal: 3 files (2 new + 1 edited)
- Total: 11 files

## Deploy staging

```bash
cd /opt/onemcp
git pull
docker compose build backend portal
docker compose up -d
sleep 20
docker compose ps
docker compose logs backend --tail=30
```

Backend auto-run migration `Skills1720100000000` → 3 tables.

## Verify staging

```bash
# 1. Tables exist
docker compose exec postgres psql -U onemcp onemcp -c "\dt"
# Expect: skills, skill_versions, skill_load_events (thêm 3 tables)

# 2. Empty list qua REST
curl -k -H "X-Onemcp-User: alice" https://onemcp.local/api/skills
# Expect: []

# 3. Seed 1 skill manual (test UI trước khi có GitLab webhook)
docker compose exec postgres psql -U onemcp onemcp <<'EOF'
INSERT INTO skills (name, department_id, "repoUrl", description, tags)
VALUES
  ('debug-guide', 1, 'https://gitlab.internal/onemcp/skills-kythuat',
   'Debug production incidents step-by-step',
   ARRAY['debug','incident','production']),
  ('session-wrapup', 1, 'https://gitlab.internal/onemcp/skills-kythuat',
   'Mandatory skill nhắc submit artifact trước end session',
   ARRAY['session','mandatory','workflow']);

INSERT INTO skill_versions (skill_id, "commitSha", version, manifest, "approvedAt")
VALUES
  (1, 'abcdef1234567890', '1.0.0', '{"manifest_version":1,"name":"debug-guide","version":"1.0.0"}'::jsonb, NOW()),
  (2, '0987654321fedcba', '1.0.0', '{"manifest_version":1,"name":"session-wrapup","version":"1.0.0"}'::jsonb, NOW());

UPDATE skills SET "currentVersionId" = 1 WHERE id = 1;
UPDATE skills SET "currentVersionId" = 2 WHERE id = 2;
EOF

# 4. Verify seed
curl -k -H "X-Onemcp-User: alice" https://onemcp.local/api/skills
# Expect: 2 skills

curl -k -H "X-Onemcp-User: alice" https://onemcp.local/api/skills/debug-guide
# Expect: detail JSON

curl -k -H "X-Onemcp-User: alice" https://onemcp.local/api/skills/debug-guide/versions
# Expect: [{ id: 1, version: '1.0.0', ... }]

# 5. Filter
curl -k -H "X-Onemcp-User: alice" "https://onemcp.local/api/skills?tag=debug"
curl -k -H "X-Onemcp-User: alice" "https://onemcp.local/api/skills?q=session"
```

## Portal test từ browser

1. https://onemcp.local → Nav thêm "Skills"
2. Click **Skills** → thấy 2 skills seeded (nếu đã seed)
3. Click tag chip filter
4. Click skill name → detail page hiển thị:
   - Description
   - Repository link
   - Tags
   - Version history table (row hiện tại highlight xanh)

## Next Session (P2 Part 2: GitLab integration)

- [ ] Git mirror service (simple-git wrapper)
- [ ] GitLab Deploy Token config (C2 mitigation)
- [ ] BullMQ queue module + Redis config
- [ ] Webhook controller `/api/webhooks/gitlab` với HMAC verify
- [ ] Skill sync worker (git fetch → parse manifest → upsert skill_versions)
- [ ] Fallback resync cron (mỗi 15 phút)
- [ ] Rate limit approve action (C1 mitigation)

## Next Session (P2 Part 3: MCP server)

- [ ] MCP server module với `@modelcontextprotocol/sdk` + HTTP+SSE transport
- [ ] MCP access middleware reuse IP CIDR + trust header
- [ ] `list_skills` MCP tool
- [ ] `load_skill` MCP tool (git show @commit_sha → stream SKILL.md)
- [ ] Load event logging
- [ ] E2E test: mock GitLab webhook → sync → MCP load

## Static-only Skill v1 (C1 Mitigation Reminder)

Manifest schema hard-enforce `permissions` chỉ được `['read']`. Nếu contributor push manifest với `permissions: ['execute']`:
- CI script trong skills repo reject.
- Backend webhook nhận manifest cũng reject qua `ManifestValidator.validateOrThrow()`.

Sandbox execution defer sang Wave 4.

## Unresolved
- GitLab base URL production (env `GITLAB_BASE_URL`) chưa xác định.
- Skill repo cấu trúc: 1 mono repo `skills-kythuat/skills/<name>/` hay 1 repo per skill? Ảnh hưởng git mirror logic.
- Owner concept: `ownerId` field trong `skills` table hiện đang NULLABLE. Set thế nào khi webhook sync (commit author → user upsert)?

## Session Metrics
- Files: 11
- LOC: ~700
- New API endpoints: 3 (list, detail, versions)
- Portal pages: 2 (list, detail)
- DB tables: +3
