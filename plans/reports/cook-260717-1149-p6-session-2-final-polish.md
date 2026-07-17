# Cook Session 13 — P6 Part 2: Final Polish + Docs Consolidation

**Date:** 2026-07-17 · **Phase:** Final v1 · **Progress:** v1 pilot-ready 100%

## Scope

Wrap up dự án — wire mọi thứ đã build, polish UX, consolidate docs.

## Delivered — Backend

### Metrics wiring
- `ArtifactsService.create()` — increment `onemcp_artifact_submits_total{type, result=ok|forbidden|duplicate}` ở 3 paths.
- `SkillsService.recordLoadEvent()` — accept `skillName` param, increment `onemcp_skill_loads_total{skill}`. McpToolsService pass skill name.
- `McpController` — increment `onemcp_mcp_tool_calls_total{tool, result=ok|error}` sau mỗi tool call.

Sau session này metrics infrastructure hoàn chỉnh — có thể scrape + dashboard thực.

### Graceful shutdown
- `main.ts` add `app.enableShutdownHooks()`. NestJS handle SIGTERM/SIGINT → drain requests + close BullMQ workers + close DB pool.
- docker-compose `stop_grace_period: 30s` cho backend service.

### Resource limits
- docker-compose `backend.deploy.resources.limits`: `memory: ${BACKEND_MEM_LIMIT:-2g}`, `cpus: '${BACKEND_CPU_LIMIT:-2}'`. Tune qua env cho prod (32GB VPS: 4g/4).

## Delivered — Portal

### Markdown renderer
- Deps: `react-markdown@^9.0.1`, `remark-gfm@^4.0.0`, `rehype-sanitize@^6.0.0`.
- `components/markdown-view.tsx` — safe markdown render. `rehype-sanitize` strip nguy hiểm tags (script, iframe, form) → XSS-safe. `remark-gfm` cho tables, task lists, autolinks. Tailwind inline styles (h1-h3, ul/ol, code, pre, blockquote, table).
- `app/artifacts/[id]/page.tsx` — thay `<pre>` bằng `<MarkdownView>`. Section headers `## Title` render đẹp, code blocks có background, tables format đúng.

## Delivered — Docs

- `docs/system-architecture.md` (rewrite) — component map ASCII, layers (ingress/access/backend/data/async), MCP surface, skills + artifact lifecycles, search, observability, backup, security posture, extension points, deployment topology.
- `docs/code-standards.md` — filename conventions, module layout, controllers/services patterns, error handling, logging redact, Zod colocation, Git conventions, anti-patterns.
- `README.md` — rewrite: v1 pilot-ready status, features shipped list, 7 MCP tools table, quick start, verify smoke test, structure map, client-side MCP config sample.
- `docs/development-roadmap.md` — added v1 completion summary với 12-session mapping.

## Files
- Backend modified: 6 (artifacts/skills service, MCP controller, main.ts, docker-compose)
- Portal new: 1 (markdown-view.tsx)
- Portal modified: 2 (artifact detail, package.json)
- Docs: 4 (system-architecture, code-standards, README, development-roadmap)

Backend build ✅ clean.

## Deploy staging

```bash
cd /opt/onemcp
git pull
docker compose build backend portal
docker compose up -d
docker compose logs backend --tail=10
```

## Verify

```bash
# 1. Metrics wired — submit artifact rồi check counter
curl -sk -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://onemcp.local/api/artifacts \
  -d '{"type":"kb","title":"Test metrics","slug":"kb-test-metrics","structured":{"problem":"testing metrics wiring","solution":"submit + check counter increment via /metrics"}}'

curl -sk https://onemcp.local/metrics | grep artifact_submits
# Expect: onemcp_artifact_submits_total{type="kb",result="ok"} 1

# 2. Skill load counter
docker compose exec -T backend wget -qO- \
  --header="X-Onemcp-User: alice" --header="Content-Type: application/json" \
  --post-data='{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"load_skill","arguments":{"name":"debug-guide"}}}' \
  http://127.0.0.1:3000/api/mcp > /dev/null

curl -sk https://onemcp.local/metrics | grep skill_loads
# Expect: onemcp_skill_loads_total{skill="debug-guide"} 1

# 3. MCP call counter
curl -sk https://onemcp.local/metrics | grep mcp_tool_calls
# Expect: multiple lines per tool

# 4. Markdown render
# Browser → https://onemcp.local/artifacts/1 → thấy sections render đẹp thay text mono raw

# 5. Graceful shutdown
docker compose stop backend
docker compose logs backend --tail=5 | grep -i shutdown
docker compose up -d backend
```

## v1 Final status

**Wave 1 (P1-P6.1) complete. Kỹ thuật pilot ready.**

- 15 modules NestJS backend
- 5 pages Next.js portal (skills, artifacts, search, review, profile)
- 5 migrations (init + skills + skill body + artifacts + attachments + search FTS)
- 11 DB tables
- 7 MCP tools
- 12 REST endpoints
- 1 daily backup service
- Prometheus metrics + deep readiness
- Client hook (Python PreCompact)
- Seed skills samples

## Post-v1 roadmap

Priority (based on user pilot feedback trước khi commit):

1. **User pilot (1-2 tuần)** — 2-3 devs install Claude Code hook, sử dụng thực.
2. **P4.2 semantic** nếu keyword search miss cases. Cần decide: embedding serving option (Ollama local? cloud API? Python microservice?).
3. **Auth v2** — SSO INET/GitLab OIDC. Extension point ready: swap `TrustUserMiddleware` → JWT middleware, downstream unchanged.
4. **P6.2 tail**: log rotation (vector/logrotate), off-site backup rclone timer, alerting rules deploy (Alertmanager), Grafana dashboard provisioning.
5. **Multi-dept rollout**: schema đã multi-tenant, chỉ cần seed depts + dept select UI.

## Unresolved (still)

- **Embedding infra decision** — không thể ship P4.2 cho tới khi ops team pick option.
- **GitLab enable** — chưa có `GITLAB_BASE_URL` staging. Sync worker code sẵn nhưng chưa test end-to-end với thực GitLab.
- **Off-site backup** — bind mount `./backups` cần mirror sang NAS/S3. Doc đã có, cron chưa auto.
- **Production TLS** — self-signed staging OK. Prod cần cert authority.
- **Load testing** — chưa benchmark. GIN indexes OK cho 10K rows theo Postgres docs; > 100K cần review query plans.

## Session Metrics
- Files modified: ~12
- LOC delta: ~400 (mostly docs)
- Backend build: ✅ clean
- All prior sessions verified deployed
