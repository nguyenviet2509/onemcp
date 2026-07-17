# Skills Samples — Seed cho `skills-kythuat` mono-repo

Copy folder này sang GitLab repo `onemcp/skills-kythuat` để enable auto sync qua webhook (P2).

## Layout expected trong GitLab

```
skills-kythuat/
├── skills/
│   ├── session-wrapup/
│   │   ├── manifest.json
│   │   └── SKILL.md
│   ├── debug-guide/
│   │   ├── manifest.json
│   │   └── SKILL.md
│   └── <thêm skills khác>/
└── README.md   (optional, cho contributors)
```

## Manual seed (chưa có GitLab)

Backend chưa enable `GITLAB_BASE_URL` → skill-sync worker skip. Có 2 cách seed:

### A. Load body qua SQL

```bash
docker compose exec -T postgres psql -U onemcp onemcp <<'EOF'
UPDATE skill_versions
SET body = pg_read_file('/skills-seed/session-wrapup/SKILL.md', 0, 100000)
WHERE id = 2;  -- session-wrapup skill_version.id
EOF
```

(Chỉ hoạt động nếu mount `/skills-seed` volume vào postgres container.)

### B. UPDATE body trực tiếp

```bash
BODY=$(cat skills-samples/session-wrapup/SKILL.md | sed "s/'/''/g")
docker compose exec -T postgres psql -U onemcp onemcp <<EOF
UPDATE skill_versions SET body = '$BODY' WHERE id = 2;
EOF
```

### C. GitLab enable (recommended production)

1. Tạo repo `onemcp/skills-kythuat` GitLab.
2. Copy `skills-samples/*` → `skills-kythuat/skills/*` → commit + push `main`.
3. Config webhook: `https://onemcp.local/api/webhooks/gitlab`, secret token = `GITLAB_WEBHOOK_SECRET`.
4. Fill `.env` trên VPS:
   ```
   GITLAB_BASE_URL=https://gitlab.internal
   GITLAB_WEBHOOK_SECRET=<same secret>
   GITLAB_MIRROR_TOKEN=<deploy token read_repository scope>
   ```
5. `docker compose up -d backend` → resync cron kích hoạt.
6. Push commit → webhook → sync worker → pending versions.
7. Admin approve qua portal → published → callable qua MCP `load_skill`.

## Contribution guidelines (put trong repo README)

- Skill folder = `skills/<name>/` (kebab-case, lowercase, alnum+dashes).
- `manifest.json`: manifest_version=1, name matches folder name, department, description ≥ 10 chars, permissions chỉ `["read"]` (C1 static-only).
- `SKILL.md`: markdown, unlimited length. Đây là content agent load.
- CI script (add sau): validate manifest schema trước merge.
