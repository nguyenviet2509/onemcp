---
phase: 05
name: onemcp CLI tool
status: completed
effort: 2-3 days
priority: P1
depends: [phase-03]
---

# Phase 05 — `onemcp` CLI tool

## Context

Ops sống trong terminal (SSH vào server, kubectl, docker exec). Portal + Claude Code là indirection. CLI cho phép:
- `onemcp search "..."` từ SSH session
- `onemcp show <runbook>` cat runbook stdout khi paged
- `onemcp submit --file postmortem.md` upload post-incident

Meet ops where they are.

## Requirements

**Functional (commands):**
- `onemcp search <query>` — top 10 results, tabular output `[type] #id · title · rank · service`
- `onemcp show <name-or-id>` — fetch full artifact/skill/runbook, cat markdown stdout
- `onemcp runbook <service>` — list runbooks cho service, prompt select nếu >1
- `onemcp submit --type <type> --file <path>` — upload markdown file, prompt cho required fields còn thiếu
- `onemcp incident start "<title>"` — tạo local context file `~/.onemcp/incident-ctx.json` với `{id, title, service, tags, startedAt}`
- `onemcp incident wrap-up` — prompt điền postmortem template, submit
- `onemcp login` — validate config, ping `/health` + `/api/artifacts?limit=1` với credential
- `onemcp config` — set/show `base_url`, `user`, `default_service`

**Non-functional:**
- Node.js CLI (đã có node ecosystem, single binary via `bun build --compile` hoặc `pkg` optional)
- Config file `~/.onemcp/config.json` với `{baseUrl, user, defaultService}`
- Env override: `ONEMCP_BASE_URL`, `ONEMCP_USER`
- Colored output (chalk) with `--no-color` flag
- Exit codes: 0=ok, 1=general error, 2=auth, 3=not-found, 4=network
- `--json` flag return raw JSON cho pipe/script

## Related files

**Create new pnpm workspace package:**
- `cli/package.json` — name `@onemcp/cli`, bin `onemcp`
- `cli/src/index.ts` — CLI entry, use `commander` hoặc vanilla arg parse
- `cli/src/commands/search.ts`
- `cli/src/commands/show.ts`
- `cli/src/commands/runbook.ts`
- `cli/src/commands/submit.ts`
- `cli/src/commands/incident.ts`
- `cli/src/commands/config.ts`
- `cli/src/commands/login.ts`
- `cli/src/lib/api-client.ts` — fetch wrapper với header, timeout, retry
- `cli/src/lib/config-store.ts` — read/write ~/.onemcp/config.json
- `cli/src/lib/incident-context.ts` — read/write ~/.onemcp/incident-ctx.json
- `cli/src/lib/output.ts` — table print, JSON mode, color

**Modify:**
- `pnpm-workspace.yaml` — thêm `cli` vào packages
- `README.md` — add CLI section

## Config schema

```json
{
  "baseUrl": "https://onemcp.local",
  "user": "alice",
  "defaultService": null,
  "tlsVerify": false
}
```

## Distribution

**Option A** — GitLab release binary
- `bun build cli/src/index.ts --compile --outfile onemcp-linux-x64` (works on Linux ops)
- Attach binary to GitLab release, ops `curl -o /usr/local/bin/onemcp && chmod +x`

**Option B** — npm-style install (recommend cho pilot)
- `pnpm build` output `cli/dist/`
- Install: `sudo npm i -g /path/to/cli` hoặc symlink
- Đơn giản hơn, no cross-compile mess

**Chọn B cho pilot**, chuyển A nếu cần distribute non-node hosts.

## Implementation steps

1. Setup pnpm workspace package `cli/`
2. `api-client.ts` — GET/POST wrapper, header injection, error map
3. `config-store.ts` — mkdir + JSON read/write
4. Command `login` — simplest, verify infra work
5. Command `search` — reuse `/api/search` REST, tabular render
6. Command `show` — smart resolve: nếu numeric → artifact id; nếu string có `-` → skill/runbook name; try artifact slug fallback
7. Command `runbook` — GET `/api/artifacts?type=runbook&service=...`
8. Command `submit` — read file, POST artifact với type. Nếu thiếu required, interactive prompt (inquirer hoặc readline vanilla)
9. Command `incident start/wrap-up` — file state, guide flow
10. Package.json bin field, `pnpm install -g ./cli` local test
11. Docs `docs/cli-guide.md` mới

## Todo

- [ ] pnpm workspace package skeleton
- [ ] api-client + config-store
- [ ] login command
- [ ] search command + tabular output
- [ ] show command with smart resolve
- [ ] runbook command
- [ ] submit command with prompts
- [ ] incident start + wrap-up
- [ ] config command
- [ ] --json flag support
- [ ] Colored output + --no-color
- [ ] Exit codes standardized
- [ ] Test on 1 real ops machine (SSH VPS)
- [ ] Metrics counter `onemcp_cli_commands_total{cmd}` (backend đã có, CLI chỉ gọi API)
- [ ] Docs cli-guide.md
- [ ] README section

## Success criteria

- Ops SSH vào server, chạy `onemcp search "disk full"` → thấy top 5 result trong <2s
- `onemcp show postgres-disk-full` → cat runbook lên stdout ready để đọc/execute
- `onemcp incident wrap-up` guide user điền postmortem — output success, artifact #N created
- `--json` flag return raw để pipe vào jq

## Risks

| Risk | Mitigation |
|---|---|
| Windows ops? | Node cross-platform OK, test qua git-bash / PowerShell |
| TLS self-signed staging | Config `tlsVerify: false` opt-in, warn user |
| Interactive prompts trong non-TTY (CI) | Detect `process.stdout.isTTY`, fallback flags |
| Auth token nếu Auth v2 sau này | Config schema extensible, thêm `token` field khi cần |
| Bundle size CLI | Không cần care, install once |

## Notes

- **Không dùng inquirer.js** (bloat) — vanilla readline đủ prompt input.
- **Không dùng commander** nếu KISS đủ — tự parse `process.argv` OK cho ~8 commands.
- Actually **dùng commander@11** — API stable, size chấp nhận được, giảm bug arg parsing.

## Red Team Redlines (2026-07-17)

- **[RT-5, Critical] Cut scope to MVP-3 commands: `search`, `show`, `submit`.** Defer `incident start/wrap-up` (local state file goes stale across SSH hosts), `login` (fold verification into first API call), `config` (env vars only for pilot), `runbook` (thin wrapper — `search --type=runbook --service=X` covers it), `--json` mode, colored output, exit-code taxonomy. Reason: 8 commands × cross-platform × config store × TTY detection = 3-4 days realistic, blows the 7-9d plan budget. Post-pilot re-scope adds the rest only if ops actually miss them.
- **[RT-4, Critical] CLI has no auth for mutation commands.** Do NOT merge `submit`/`incident wrap-up` (any command that writes) without a real auth token. At minimum:
  - Add `token` field to config (Bearer). Send as `Authorization: Bearer $token`. Backend must reject write requests where trust-header `user` ≠ token owner.
  - Write config file with `chmod 0600`, parent dir `0700`. Refuse to run if perms too open.
  - **Default `tlsVerify: true`.** Require explicit `--insecure` flag or `ONEMCP_INSECURE=1` env to disable, print a loud warning each command.
  - Roadmap: OS keychain (macOS Keychain, libsecret, wincred) instead of plain JSON when Auth v2 lands.
- **[RT-12, High] Environment survey before choosing distribution.** Verify target ops jump hosts have Node ≥18 pre-installed. If not, commit to `bun build --compile` (~90MB per-OS binary) and test on Ubuntu 22.04 minimum. Fallback plan: ship a `curl | sh` wrapper hitting REST directly (bash-only). Add "ops-env survey" as Phase 0 dependency, block Phase 05 dev until answered.

<!-- Updated: Validation Session 1 (V3) — Phase 0 ops-env survey task added; Phase 05 blocked until survey completes. Fallback if Node absent: bash `curl | sh` wrapper. Effort revised 2-3d → 1.5d after V5 scope cut. -->
<!-- Updated: Validation Session 1 (V5) — CLI cut to 3 commands: `search`, `show`, `submit`. Remove from scope: `runbook`, `incident start/wrap-up`, `login`, `config`, `--json` mode, colored output, exit-code taxonomy. Restore post-pilot if ops miss features. -->
- **[Related — File-upload safety, from Sec-adversary #5]** `onemcp submit --file <path>`: cap size (256 KB), reject binary, run naive secret-scan regex (JWT / `AWS_`/ `Bearer ` / `password=` / `-----BEGIN`), print first 20 lines + total size, require `[y/N]` unless `--yes`. Ops on a prod host will otherwise `submit --file /var/log/postgres.log` and leak credentials into searchable KB.
