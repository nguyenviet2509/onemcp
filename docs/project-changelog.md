# OneMCP Project Changelog

Log tất cả significant changes, features, fixes, security updates.

## 2026-07-17 — Ops Incident Response Core (P7)

**Status:** Shipped | **Duration:** 6 dev days + 1d QA/deploy

### Phase 1: Post-mortem Template
- New artifact type `postmortem` with 4 required fields: `summary`, `timeline`, `root_cause`, `action_items`.
- Zod schema validation + body compiler.
- Portal form auto-generated from template.

### Phase 2: Runbook Artifact Type + Workflow
- New artifact type `runbook` (structure: title, service, mitigation_steps, tags).
- Database migration: add `artifacts.service` column (VARCHAR 64, indexed) for Phase 03 search boost.
- Feature flag `ONEMCP_ENABLE_OPS_TYPES=1` gates new types.
- Runbook-specific CRUD endpoints + versioning model (inherit artifact lifecycle).

### Phase 3: Service Tag Boost + Filter Search
- Service-aware ranking: +2.0 for runbook matching explicit/detected service, +1.0 for tag match.
- Auto-detect service from query via word-boundary regex `\bservice\b` (case-insensitive).
- Backward compatible: boost only when service hint present; base ranking unchanged.
- Red team fix: case-normalized matching + word boundary prevents false positive rank (e.g., `redis` ≠ `redistribute`).

### Phase 4: Structured Logs Field
- MVP: `raw_logs` JSONB field on postmortem artifact.
- Render as Markdown code fence (no line numbers / copy / collapse for P7).
- Compiler validates fence syntax during submit.

### Phase 5: OneMCP CLI Tool
- 3-command MVP (`search`, `show`, `submit`). Scope cut from 8 (red team RT-5).
- HTTP client with Bearer auth for mutations; validates TLS cert (no `insecure_skip_verify`).
- Distribution: Node.js + npm registry OR curl-bash wrapper fallback (TBD post-env-survey Phase 0).
- Metrics: `onemcp_cli_commands_total{cmd}` tracked per invocation.

### Phase 6: Alertmanager Webhook → KB Suggest
- New endpoint `POST /api/webhooks/alertmanager` (Bearer token auth + TLS).
- 202 Async response; dedup via Postgres `alertmanager_dedup` table (fingerprint SHA256, 4h TTL).
- SearchService with `bypassDeptFilter=true` (system-alertmanager user) — cross-dept runbook discovery.
- Slack post (SLACK_ONCALL_WEBHOOK_URL) with sanitized alert labels (Markdown backticks, @ escape).
- Red team fixes: persisted dedup (not in-memory), 202 async ACK to prevent amplification, Slack injection blocking.

### Supporting Changes
- New MCP tool: `load_runbook(id)` — returns runbook + logs load event to `runbook_load_events` table (user_id, source, client_ip, timestamp).
- System user `system-alertmanager` created at migration time (bypassDeptFilter for webhook).
- Metrics added: `onemcp_runbook_loads_total{name}`, `onemcp_alert_matches_total{alertname}`, `onemcp_cli_commands_total{cmd}`.
- Database tables: `alertmanager_dedup` (dedup logic), `runbook_load_events` (audit + observability).
- Environment additions: `ALERTMANAGER_WEBHOOK_TOKEN`, `SLACK_ONCALL_WEBHOOK_URL`, `ONEMCP_KNOWN_SERVICES` (comma-separated allowlist).

### Documentation
- New: `docs/ops-env-survey.md` (ops jump-host environment pre-flight check).
- New: `docs/alertmanager-integration.md` (webhook config + prerequisites).
- Updated: `docs/system-architecture.md` (Ops Incident Response section, MCP tools 7→8, migrations, SYSTEM_USER scoping).
- Updated: `docs/code-standards.md` (feature-flag gating pattern).
- Updated: `README.md` (P7 features, MCP tools count, docs links).

### Risks Mitigated
- **Alertmanager dedup flood** (RT-7, RT-8): server-side persisted dedup + 202 ACK async pattern prevents loop amplification.
- **Cross-dept leak** (RT-2): SYSTEM_USER with explicit `bypassDeptFilter` flag + audit trail; non-system users remain scoped.
- **Slack injection** (RT-6): alert labels sanitized before JSON serialization.
- **CLI auth** (RT-4): HTTP Basic + TLS validation required; reject plaintext creds.
- **Service ranking false positive** (RT-10): word-boundary + case-normalized match prevents `redis` matching `redistribute`.

### Red Team Accepts & Rejections
- **Accepted:** 15/15 findings (Blockers A–D resolved per decision log).
- **Rejected:** 3 (low-priority, rationale in plan.md).

### Known Limitations (Deferred)
- Runbook audit access / IP PII masking → Phase 6.2 (RT-15).
- Grafana annotation source, health dashboard portal tab → post-pilot P2.
- On-call daily digest Slack → post-pilot P3.

---

## Earlier Phases

### P6.1 Hardening (2026-07-11)
- Prometheus metrics + HTTP instrumentation (request/duration per endpoint).
- Deep `/ready` health check (Postgres + MinIO connectivity).
- Daily backup service (pg_dump -Fc + mc mirror MinIO, 14-day retention).

### P5.2 Client Hook (2026-07-03)
- Python PreCompact reminder script (`onemcp-wrapup-check.py`).
- Seed skills content (session-wrapup, debug-guide samples).

### P5 Templates (2026-06-28)
- Zod schemas per artifact type (report, research, kb).
- Structured content validation + body auto-compile.
- MCP `get_artifact_template` tool.

### P4 Search (2026-06-20)
- Full-text search (unaccent Vietnamese diacritics + pg_trgm trigram fuzzy on title).
- `SearchService.search()` with rank boost.

### P3 Artifacts (2026-06-10)
- Report/research/kb CRUD, append-only versioning.
- Review workflow (pending → published).
- MinIO attachment proxy (100MB cap, Content-Type whitelist, SHA256 verify).

### P2 Skills (2026-05-25)
- Git-sync from GitLab mono-repo, manifest schema (static-only v1).
- MCP `list_skills` + `load_skill` with load event audit.

### P1 Access (2026-05-10)
- IP CIDR guard + trust header identity (X-Onemcp-User).
- RBAC (viewer/contributor/maintainer/dept-admin/super-admin).
- Audit events logging.
