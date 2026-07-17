# Ops Environment Survey — Phase 0 Blocker

**Purpose:** Trước khi build CLI (Phase 05), phải biết ops jump-hosts có gì. Điền bảng dưới → decide distribution channel.

## Survey template

| # | Host role | OS | Node ≥18? | pnpm/npm? | bash? | curl? | jq? | Notes |
|---|-----------|----|-----------|-----------|-------|-------|-----|-------|
| 1 | jumphost-01 (SSH gateway) | | | | | | | |
| 2 | postgres-primary VM | | | | | | | |
| 3 | redis-01 VM | | | | | | | |
| 4 | nginx-01 VM | | | | | | | |
| 5 | k8s ops workstation | | | | | | | |

## Decision matrix

| Scenario | Distribution |
|----------|-------------|
| Node ≥18 available on ALL rows | `pnpm install -g @onemcp/cli` (as originally planned) |
| Node absent on ≥1 row | `bun build --compile` single binary, Ubuntu 22.04 target |
| Node absent AND bash+curl+jq present everywhere | Shell wrapper `curl \| sh` install script, ~50 lines |
| Mixed (Windows ops box in the mix) | Node install OR standalone binary — no bash wrapper |

## Action items

- [ ] Ops team lead fills the table above (est. 30 min)
- [ ] Attach output to this file
- [ ] Update `phase-05-onemcp-cli.md` Distribution section with chosen path
- [ ] Confirm Alertmanager access (needed for Phase 06 staging test)
- [ ] Confirm Slack workspace + provisioned `#kythuat-oncall` webhook URL

## Dependencies awaited

- **SLACK_ONCALL_WEBHOOK_URL** — ops team provisions from Slack admin panel
- **ALERTMANAGER_WEBHOOK_TOKEN** — dev generates 32-byte hex, share via secret channel
- **Alertmanager config edit access** — for Phase 06 staging integration test

## Sign-off

- Ops lead: _______________ Date: _______
- Backend lead: _______________ Date: _______
