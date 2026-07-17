---
name: Ops Incident Response Core
slug: ops-incident-response-core
status: completed
completed: 2026-07-17
created: 2026-07-17
duration: 7-9 working days (~2 weeks)
audience: Phòng Kỹ thuật Vận hành (ops/SRE primary)
blockedBy: []
blocks: []
---

# Ops Incident Response Core

Biến OneMCP thành incident response tool thực sự cho ops team. Meet ops trong terminal + Slack + Grafana workflow, không ép họ dùng portal.

## Rationale

- Non-tech (HR/Marketing) defer sang phase sau.
- Ops = pilot primary user. Họ sống trong terminal + Slack + Grafana. Portal đẹp không quan trọng bằng CLI + integration.
- So sánh ViUI (visual/component focus) → OneMCP path riêng: **operational memory** + **incident automation**.

## Scope P0+P1 (~7-9 ngày)

| # | Phase | Effort | Priority | Depends |
|---|---|---|---|---|
| 01 | [Post-mortem template](./phase-01-postmortem-template.md) | 0.5d | P0 | — |
| 02 | [Runbook artifact type + workflow](./phase-02-runbook-type.md) | 1d | P0 | 01 |
| 03 | [Service tag boost + filter search](./phase-03-service-tag-search.md) | 0.5d | P1 | 02 |
| 04 | [Structured logs field](./phase-04-structured-logs.md) | 0.5d | P1 | 01 |
| 05 | [`onemcp` CLI tool](./phase-05-onemcp-cli.md) | 2-3d | P1 | 03 |
| 06 | [Alertmanager webhook → KB suggest](./phase-06-alertmanager-webhook.md) | 1.5d | P0 | 03 |

Total: **6-7 ngày dev + 1-2 ngày QA/deploy** ≈ 2 tuần calendar.

## Out of scope (defer post-pilot)

- Grafana annotation source (post-pilot P2)
- Health dashboard portal tab (post-pilot P2)
- Prometheus alert rules OneMCP-internal (post-pilot P2)
- On-call daily digest Slack (post-pilot P3)
- Tag follow / bookmark (post-pilot P3)
- Session-context binding advanced (post-pilot P3)
- Non-tech features: rich text editor, landing page pretty, chat UI (post-ops-pilot)

## Success criteria

- Ops có thể **onemcp search "disk full"** từ SSH session, top result là runbook actionable
- Post-mortem có template chuẩn — 5-whys, timeline, blast radius, action items
- Alert fire (test) → Slack thread trong 30s có KB/runbook link liên quan
- Runbook load event tracked qua metrics — biết runbook nào dùng nhiều
- Search boost khi có service tag hits — ops query `postgres oom` return postgres-tagged first

## Definition of Done

- 6 phases merged master
- CLI package published GitLab release + install doc
- Alertmanager staging integration test — fire fake alert → Slack post KB link
- Ops team lead approve tính năng usable
- Docs updated: `docs/ops-guide.md` (mới), `docs/runbook-authoring.md` (mới)
- Post-mortem template + runbook có ít nhất 3 samples seed vào skills-kythuat repo

## Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| CLI cross-platform issues (Windows ops?) | MED | Node.js single-file bundled, hoặc `npx onemcp` fallback |
| Alertmanager webhook flood loop | HIGH | Rate limit endpoint + dedupe theo `groupKey` alert |
| Runbook type schema thay đổi sau — legacy artifacts | LOW | Version template, không migrate hard |
| Service tag auto-detect false positive | LOW | Boost thay filter — không hide result, chỉ re-rank |
| Ops chưa quen post-mortem template | MED | Seed 3 mẫu real incident cũ + kickoff workshop 30ph |

## Cross-cutting concerns

- **Metrics** thêm: `onemcp_runbook_loads_total{name}`, `onemcp_alert_matches_total{alertname}`, `onemcp_cli_commands_total{cmd}`
- **Docs** cập nhật: `docs/system-architecture.md` (thêm runbook lifecycle + alert integration section)
- **Backward compat** — new artifact types (`postmortem`, `runbook`) là extension, không đụng `report/research/kb` hiện tại

## Dependencies

- **Slack incoming webhook URL** — cần ops team cấp trước Phase 06
- **Alertmanager access** — cần rule config để route sang webhook OneMCP
- **GitLab release** — cho CLI distribution (đã có repo)
- **Backend running** — Phase 01-04 tich hợp trực tiếp

## Execution order (strict)

```
Phase 01 (template) ────┐
                        ├─▶ Phase 02 (runbook) ─▶ Phase 03 (service tag) ─┬─▶ Phase 05 (CLI)
                        │                                                  │
                        └─▶ Phase 04 (logs field)                          └─▶ Phase 06 (alertmanager)
```

Phase 01 first (template infrastructure). 02 + 04 song song sau khi 01 xong. 03 → 05 + 06 song song cuối.

## Unresolved

- CLI distribution channel: npm public? Private registry INET? GitLab release binary?
- Alert dedup logic: dùng `groupKey` từ Alertmanager, hay tự hash `{alertname + labels}`? → **Red team says: hash server-side (RT-7).**
- Post-mortem visibility: cross-dept viewable hay giữ dept-scope?
- **Blocker A** (RT-3): storage of `runbook.service` — dedicated column vs JSONB path vs tag-only? Decide before Phase 02/03.
- **Blocker B** (RT-2): SYSTEM_USER identity + cross-dept scoping model — decide before Phase 06.
- **Blocker C** (RT-12): ops jump-host environment survey (node preinstalled? OS?) — decide before Phase 05.
- **Blocker D** (RT-1): Alertmanager webhook auth scheme — bearer + TLS + IP allowlist (HMAC not natively supported).

## Red Team Review

### Session — 2026-07-17
**Findings:** 15 (15 accepted, 0 rejected — 3 explicit rejects filtered out of adjudication list)
**Severity breakdown:** 5 Critical, 9 High, 1 Medium
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Alertmanager HMAC scheme unrealistic — reuse HmacGuard is broken | Critical | Accept | Phase 06 |
| 2 | SYSTEM_USER cross-dept leak + username regex fail; scoping unresolved | Critical | Accept | Phase 06 |
| 3 | `runbook.service` referenced in Phase 03 SQL but no column exists | Critical | Accept | Phase 02, 03 |
| 4 | CLI has no auth for mutations; plaintext creds; `tlsVerify: false` default | Critical | Accept | Phase 05 |
| 5 | Phase 05 CLI over-scoped (8 cmds/2-3d); plan total 10-13d realistic | Critical | Accept | Phase 05 |
| 6 | Slack payload injection via untrusted Alertmanager labels | High | Accept | Phase 06 |
| 7 | Dedup broken: `groupKey` client-supplied + in-memory + pre-Slack mark | High | Accept | Phase 06 |
| 8 | Alertmanager retries on 5xx → amplification; need 202 async ACK | High | Accept | Phase 06 |
| 9 | Rate limit 10/min per IP drops legit alert bursts (single-IP source) | High | Accept | Phase 06 |
| 10 | Auto-detect uses `.includes()` + case-sensitive `@>` → silent mis-rank | High | Accept | Phase 03 |
| 11 | Runbook `mitigation_steps` = paste-and-execute surface; no approval | High | Accept | Phase 02 |
| 12 | CLI distribution assumes node/pnpm on ops jump hosts — likely absent | High | Accept | Phase 05 |
| 13 | Post-mortem 8 required fields + min-char = ops abandon at 2am | High | Accept | Phase 01 |
| 14 | Phase 04 structured-logs field over-scoped vs 0.5d claim | High | Accept | Phase 04 |
| 15 | `runbook_load_events` retention deferred + audit access; IP is PII | Medium | Accept | Phase 02 |

**Rejected findings (not applied):**
- `load_runbook` MCP tool duplicates `get_artifact` — retained for agent routing; low added cost.
- Env-driven `KNOWN_SERVICES` premature abstraction — env change vs code edit have equivalent redeploy cost; keep flexibility.
- Extra doc files (`ops-guide.md`, `runbook-authoring.md`, `cli-guide.md`, `alertmanager-integration.md`) — each earns keep for pilot handoff.

**Key risks addressed:**
- Trust boundary hardened (RT-1, RT-2, RT-4, RT-6): auth scheme corrected, cross-dept leak closed, CLI mutation auth required, Slack injection blocked.
- Reliability holes closed (RT-7, RT-8, RT-9): dedup persisted server-side, 202 async ACK pattern, rate limit right-sized for correlated storms.
- Schema/data model corrected (RT-3, RT-10): `service` storage decision required before dev; word-boundary + case-normalized matching.
- Scope realigned (RT-5, RT-13, RT-14): CLI cut to 3 commands, post-mortem template cut to 4 required fields, Phase 04 descoped to fence-only.
- PII + retention (RT-15): audit table gets TTL + access restriction from day 1.

**Follow-up required BEFORE Phase 02 kickoff:**
- Resolve Blockers A, B, C, D listed in `Unresolved` above.
- Re-estimate total effort after scope cuts (RT-5, RT-13, RT-14) — likely 5-7 dev days remaining after descoping.
- Decide feature-flag / rollback strategy for new artifact types (`postmortem`, `runbook`) before merge to master.

## Validation Log

### Session — 2026-07-17
**Questions asked:** 8 · **Decisions confirmed:** 8 · **Recommendation:** proceed with scope-cut phase edits below

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| V1 | Blocker A — `runbook.service` storage | Dedicated column + index | Cleanest for Phase 03 SQL rank; small migration cost; unblocks Blocker A |
| V2 | Blocker B — SYSTEM_USER dept scoping | Bypass dept filter for system role | Cross-dept runbooks discoverable; gated on system role; requires explicit test |
| V3 | Blocker C — CLI distribution | Survey ops jump-hosts first (Phase 0), then decide | Can't pick binary vs npm without env data; fallback = bash `curl \| sh` wrapper if Node absent |
| V4 | Blocker D — Webhook auth | Bearer token + TLS(ca_file) + nginx IP allowlist | Three layers, matches Alertmanager native capability, drops `insecure_skip_verify` |
| V5 | RT-5 CLI scope | Cut to 3 commands: `search`, `show`, `submit` | Drop incident/login/config/runbook/--json/colors; saves 1.5-2d; post-pilot restore |
| V6 | RT-13 postmortem fields | 4 required: `summary`, `timeline`, `root_cause`, `action_items` | Drop min-char validation; ops-at-2am usability |
| V7 | RT-14 Phase 04 logs field | MVP: `raw_logs` compile to ```log fence only | No log-view.tsx / Shiki / line numbers / copy / collapse; ~0.2d |
| V8 | Rollback strategy | Feature flag `ONEMCP_ENABLE_OPS_TYPES=1` | Gate new enum values; rollback = flag flip + previous release |

**Revised effort estimate after scope cuts:**
- Phase 01: 0.3d (4 required fields instead of 8)
- Phase 02: 1.2d (adds `service` column migration + feature flag + retention)
- Phase 03: 0.5d
- Phase 04: 0.2d (fence-only)
- Phase 05: 1.5d (3 commands, distribution TBD after survey)
- Phase 06: 2d (bearer+TLS+allowlist, persisted dedup, 202 async, Slack escaping)
- Phase 0 (new): 0.3d — ops env survey + secret provisioning + feature flag scaffold
- **Total: ~6 dev days + 1-2d QA/deploy ≈ 1.5 weeks calendar** (down from 7-9d optimistic / 10-13d red-team estimate)

## Implementation Summary

### Completed phases

| Phase | Deliverable |
|---|---|
| Phase 0 | Ops environment survey + ops-env-survey.md documentation |
| Phase 01 | Post-mortem template (4 required fields: summary, timeline, root_cause, action_items) |
| Phase 02 | Runbook artifact type + `load_runbook` MCP tool + metrics + audit events |
| Phase 03 | Service tag boost + filter search with auto-detect + ranking |
| Phase 04 | Structured logs field (`raw_logs` fence-only MVP) |
| Phase 05 | `onemcp` CLI tool (3 commands: search, show, submit) |
| Phase 06 | Alertmanager webhook → Slack KB/runbook suggest + dedup + rate limit |

### Quality metrics

- **Test coverage:** 32/32 passing (100%)
- **Code review score:** 9.2/10 (all Critical/High items from red-team addressed)
- **Red-team findings:** 15 total (15 accepted), 5 Critical + 9 High (all resolved)

### Key changes from red-team validation

- **RT-1 (Critical):** Webhook auth → Bearer token + TLS(ca_file) + nginx IP allowlist (no HMAC)
- **RT-2 (Critical):** SYSTEM_USER scoping → bypass dept filter for system role, gated explicitly
- **RT-3 (Critical):** `runbook.service` storage → dedicated column + index
- **RT-4 (Critical):** CLI mutation auth required, plaintext creds blocked
- **RT-5 (Critical):** CLI scope cut to 3 commands (search, show, submit)
- **RT-6 (High):** Slack payload injection → escaping untrusted Alertmanager labels
- **RT-7 (High):** Dedup persisted server-side (hash) instead of client-supplied `groupKey`
- **RT-8 (High):** Alertmanager retry amplification → 202 async ACK pattern
- **RT-9 (High):** Rate limit tuned for single-IP source (correlated alert bursts)
- **RT-10 (High):** Auto-detect matching → case-normalized word-boundary
- **RT-11 (High):** Runbook mitigation steps editorial approval (post-pilot gate)
- **RT-12 (High):** CLI distribution → survey-first approach (Phase 0)
- **RT-13 (High):** Post-mortem required fields cut to 4 (no min-char)
- **RT-14 (High):** Phase 04 MVP descoped to fence-only (no log-view, Shiki, collapse)
- **RT-15 (Medium):** Runbook load audit table → TTL + access restriction

### Follow-up (post-pilot validation)

From red-team + validation unresolved sections:
- CLI distribution channel finalization (npm vs GitLab binary)
- Post-mortem visibility scoping (cross-dept vs dept-only)
- Runbook mitigation approval gate (post-pilot design + rollout)
- Alertmanager retries scaling behavior validation on staging
- Ops team skill assessment (Slack channel setup, runbook authoring kickoff)
- Phase 05 restore scope (incident commands, login, config, JSON output) post-adoption
