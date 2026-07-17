# onemcp CLI

Terminal client for OneMCP — search, show, and submit artifacts from SSH sessions.

## Commands (V5 scope)

```
onemcp search <query> [--limit N] [--service NAME]
onemcp show <id-or-slug>
onemcp submit --type <type> --file <path> [--yes]
```

## Install (Node package)

Requires Node >= 18.

```bash
# From repo root
pnpm --filter @onemcp/cli build
npm install -g ./cli        # global install
# OR: add to PATH via symlink
ln -sf $(pwd)/cli/dist/index.js /usr/local/bin/onemcp
chmod +x /usr/local/bin/onemcp
```

## Install (bash wrapper — no Node required)

```bash
curl -o /usr/local/bin/onemcp https://your-host/cli/onemcp.sh
chmod +x /usr/local/bin/onemcp
```

Requires: `curl`, `jq`, `bc` (for size display).

## Config

Create `~/.onemcp/config.json` with chmod 600:

```bash
mkdir -p ~/.onemcp
cat > ~/.onemcp/config.json <<'EOF'
{
  "baseUrl": "https://onemcp.local",
  "user": "alice",
  "token": "your-bearer-token",
  "defaultService": "postgres",
  "tlsVerify": true
}
EOF
chmod 600 ~/.onemcp/config.json
```

### Environment overrides

| Variable | Description |
|---|---|
| `ONEMCP_BASE_URL` | API base URL |
| `ONEMCP_USER` | Username (X-Onemcp-User header) |
| `ONEMCP_TOKEN` | Bearer token for write ops |
| `ONEMCP_INSECURE=1` | Disable TLS verification (prints warning) |

## Usage examples

```bash
# Search for runbooks about disk issues
onemcp search "disk full" --service postgres --limit 5

# Show a specific artifact by ID or slug
onemcp show 42
onemcp show postgres-disk-full-runbook

# Submit a post-mortem markdown file
onemcp submit --type postmortem --file ./postmortem-2026-07-17.md

# Submit without confirmation prompt (CI/scripts)
onemcp submit --type runbook --file ./runbook.md --yes

# Self-signed cert (staging)
ONEMCP_INSECURE=1 onemcp search "test"
# OR per-command
onemcp search "test" --insecure
```

## Security notes

- Config file must be `chmod 600`. CLI refuses to run if permissions are too open (Linux/macOS).
- `submit` requires `token` in config or `ONEMCP_TOKEN` env.
- `--insecure` / `ONEMCP_INSECURE=1` disables TLS verification and prints a loud warning. Never use in production.
- File submission is scanned for secrets before upload: AWS keys, private keys, Bearer tokens, JWTs, password assignments. Files with detected secrets are rejected even with `--yes`.
- Max file size: 256 KB. Binary files are rejected.

## Artifact types

| Type | Description |
|---|---|
| `report` | General report |
| `research` | Research document |
| `kb` | Knowledge base article |
| `postmortem` | Incident post-mortem |
| `runbook` | Operational runbook |

## Build

```bash
cd cli
pnpm install
pnpm build        # tsc → dist/
pnpm typecheck    # type check only
```
