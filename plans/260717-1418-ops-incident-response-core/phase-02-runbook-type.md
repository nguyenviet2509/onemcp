---
phase: 02
name: Runbook artifact type + workflow
status: completed
effort: 1 day
priority: P0
depends: [phase-01]
---

# Phase 02 — Runbook artifact type + workflow

## Context

KB = reactive post-bug. Skill = static protocol. Runbook = **operational action document** trigger được khi paged: "symptoms → verify → mitigate → escalate". Cần first-class citizen, không nhét vào KB.

## Requirements

**Functional:**
- Thêm artifact type `runbook` vào enum
- Template fields:
  - `service` (text, required) — postgres | redis | nginx | backend | portal | minio | …
  - `symptoms` (markdown, required, min 30) — alert signals + observable symptoms
  - `verify_command` (markdown, required, min 20) — commands verify assumption
  - `mitigation_steps` (markdown, required, min 100) — numbered steps
  - `verification_after` (markdown, required, min 20) — check-post mitigation
  - `escalation_path` (markdown, required, min 20) — who to page next
  - `related_alerts` (text, optional) — comma-separated Alertmanager alertname
  - `severity_impact` (markdown, optional) — SEV mapping
- Body compile: sections với h2 headers ops-friendly
- MCP tool `load_runbook` — dedicated tool tách khỏi `get_artifact` để agent prioritize khi paged
- Metrics counter `onemcp_runbook_loads_total{name, service}` — track adoption

**Non-functional:**
- Runbook load ưu tiên hơn KB trong incident context (Phase 03 boost + Phase 06 alert match)
- Load event ghi vào audit log riêng (reuse `skill_load_events` schema hoặc mới) — Phase sau daily digest dùng

## Related files

**Modify:**
- `backend/src/artifacts/artifact-type.enum.ts` — thêm `'runbook'`
- `backend/src/artifacts/templates/template-registry.ts` — register runbook template
- `backend/src/mcp/mcp-tools.service.ts` — thêm tool definition `load_runbook` + handler; update 3 enum chỗ khác
- `backend/src/metrics/metrics.service.ts` — thêm counter `runbookLoads`
- `backend/src/artifacts/artifacts.service.ts` — thêm method `loadRunbook(user, service|name)` với record event
- `backend/src/db/migrations/1720600000000-runbook-load-events.ts` — new migration cho bảng `runbook_load_events(id, artifact_id, artifact_version_id, user_id, ts, ip)` (parallel schema với skill_load_events)

## MCP tool `load_runbook`

```
Description: "Tải runbook operational theo tên hoặc service. Ưu tiên gọi khi user mô tả sự cố production."
Input:
  name?: string  (slug hoặc id)
  service?: string (nếu chưa biết specific runbook)
Behavior:
  - Nếu name: fetch, return body
  - Nếu service only: list runbooks match service, tag active-first
Output: markdown body + metadata header
Side effect: increment metrics + insert runbook_load_events row
```

## Implementation steps

1. Extend enum + array với `'runbook'`
2. Register template runbook trong template-registry
3. Migration `runbook_load_events` — FK artifacts + version, no CASCADE (audit retention)
4. `ArtifactsService.loadRunbook(user, opts)` với event insert
5. Metrics counter register + wire increment
6. MCP tool `load_runbook` definition + handler branch
7. Update 3 enum chỗ khác trong tool defs
8. Docker rebuild, run migration
9. Test: submit 1 runbook mẫu (postgres-disk-full), verify:
   - MCP `load_runbook name=postgres-disk-full` return body
   - Metrics counter tăng
   - DB row `runbook_load_events` insert

## Todo

- [ ] Enum + template registration
- [ ] Migration runbook_load_events
- [ ] `loadRunbook()` service method
- [ ] Metrics counter runbookLoads
- [ ] MCP tool load_runbook def + handler
- [ ] Update artifact-type enum trong 3 tool schemas khác
- [ ] Backend rebuild + migrate
- [ ] Seed sample runbook `postgres-disk-full` + `redis-oom-eviction`
- [ ] E2E test: submit + load qua MCP + metrics scrape verify

## Success criteria

- MCP tool list có 8 tools (7 cũ + `load_runbook`)
- Load runbook return body + audit event insert
- Metrics `onemcp_runbook_loads_total{name="postgres-disk-full",service="postgres"} 1`
- Portal list filter type=runbook work

## Risks

| Risk | Mitigation |
|---|---|
| Agent nhầm `load_runbook` vs `get_artifact` | Description rõ ràng: "prioritize khi user mô tả sự cố production" |
| Bảng load_events phình to | Retention policy — Phase sau prune > 90 days |
| Service enum cứng nhắc | Field `service` là text tự do; validate soft (warn không reject) |

## Red Team Redlines (2026-07-17)

- **[RT-3, Critical] Add `service` column to `artifacts` table (indexed) — Phase 03 SQL references `service =` as a column but the current schema only stores template fields in JSONB `structured_content`. Without this migration Phase 03 SQL 500s at runtime. Options: (a) new column populated on submit for `type=runbook` + backfill migration + index; (b) `structured_content->>'service'` expression index. Decide BEFORE Phase 02 dev starts. Add migration to Related files list.

<!-- Updated: Validation Session 1 (V1) — Option (a) selected: dedicated `artifacts.service TEXT` column + btree index, populate on submit for type=runbook. Add migration `1720600100000-add-artifacts-service.ts` to Related files.  -->
<!-- Updated: Validation Session 1 (V8) — Gate new enum values `postmortem`/`runbook` behind `ONEMCP_ENABLE_OPS_TYPES=1` feature flag. Validator rejects submit if types requested with flag off. Rollback = flag flip + previous release. -->
- **[RT-11, High] Runbook approval/authoring safety:** `mitigation_steps` and `verify_command` are commands ops paste into prod shells. Add: (a) publish requires `draft → approved` transition with second reviewer; (b) `onemcp show` output strips/warns on non-printable + BiDi override chars + Cyrillic homoglyphs in `sudo/rm/curl` tokens; (c) load response includes immutable authorship + version_id header for provenance. Never advertise "execute" — always human-read.
- **[RT-15, Medium] Retention + audit access for `runbook_load_events`:** add TTL now, not "phase sau". Partition by month + drop after 90 days, OR nightly `DELETE WHERE ts < now() - interval '90 days'` cron. IP address is PII → store hashed (`sha256(ip + secret)`) or omit. Restrict SELECT to admin role. Add row-count Prometheus gauge to catch runaway growth.
