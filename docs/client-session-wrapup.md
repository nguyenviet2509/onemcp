# Client-side Session Wrap-Up

3 lớp enforce workflow "capture-knowledge-before-end-session":

## Lớp 1 — MCP skill hint

Skill `session-wrapup` (seed từ `skills-samples/session-wrapup/`) — agents load qua MCP `load_skill` để biết protocol.

```bash
# Verify skill available
docker compose exec -T backend wget -qO- \
  --header="X-Onemcp-User: alice" --header="Content-Type: application/json" \
  --post-data='{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"load_skill","arguments":{"name":"session-wrapup"}}}' \
  http://127.0.0.1:3000/api/mcp | jq -r '.result.content[0].text'
```

## Lớp 2 — Claude Code MCP config

`~/.claude/settings.json` trên máy dev:

```json
{
  "mcpServers": {
    "onemcp": {
      "type": "http",
      "url": "https://onemcp.local/api/mcp",
      "headers": { "X-Onemcp-User": "vietnt" }
    }
  }
}
```

Verify: mở Claude Code → `/mcp` → thấy `onemcp` với 7 tools.

## Lớp 3 — Pre-compact hook (guardrail)

Script `hooks/onemcp-wrapup-check.py` — kiểm tra user đã submit artifact trong session chưa. Advisory mặc định; opt-in blocking qua `ONEMCP_HOOK_STRICT=1`.

### Install

```bash
# 1. Copy script vào Claude Code hooks folder
mkdir -p ~/.claude/hooks
cp hooks/onemcp-wrapup-check.py ~/.claude/hooks/
chmod +x ~/.claude/hooks/onemcp-wrapup-check.py

# 2. Extend ~/.claude/settings.json
```

Thêm block `hooks` vào settings:

```json
{
  "mcpServers": {
    "onemcp": {
      "type": "http",
      "url": "https://onemcp.local/api/mcp",
      "headers": { "X-Onemcp-User": "vietnt" }
    }
  },
  "hooks": {
    "PreCompact": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "ONEMCP_URL=https://onemcp.local ONEMCP_USER=vietnt ONEMCP_HOOK_INSECURE=1 python3 ~/.claude/hooks/onemcp-wrapup-check.py"
          }
        ]
      }
    ]
  }
}
```

### Env config script accept

| Env | Default | Purpose |
|---|---|---|
| `ONEMCP_URL` | (empty → skip) | Base URL |
| `ONEMCP_USER` | (empty → skip) | X-Onemcp-User header |
| `ONEMCP_SESSION_HOURS` | 4 | Window "recent submit" tính từ hiện tại |
| `ONEMCP_HOOK_STRICT` | 0 | 1 = exit 1 khi không có artifact → Claude Code block compact |
| `ONEMCP_HOOK_INSECURE` | 0 | 1 = skip TLS verify (self-signed staging) |

### Test manual

```bash
ONEMCP_URL=https://onemcp.local ONEMCP_USER=vietnt ONEMCP_HOOK_INSECURE=1 \
  python3 hooks/onemcp-wrapup-check.py
# Nếu có artifact recent → "[onemcp-wrapup] ✓ N artifact(s) ..."
# Nếu không → "[onemcp-wrapup] ⚠ No artifact submitted ..."
```

### Rollout suggest

1. **Week 1**: install advisory mode (default `STRICT=0`) — quen với reminder.
2. **Week 2**: đo % session có submit. Nếu > 60% → OK.
3. **Week 3**: flip `ONEMCP_HOOK_STRICT=1` → blocking.
4. **Ongoing**: monitor `/api/artifacts` count growth. Nếu drop → gather feedback.

## Troubleshooting

- **Hook silent, không print gì**: check `ONEMCP_URL` + `ONEMCP_USER` set. Empty → script skip (fail-safe).
- **"cannot reach OneMCP"**: VPN chưa on, hoặc DNS `onemcp.local` chưa resolve. Check `curl -k https://onemcp.local/health`.
- **403 Access denied**: IP máy dev không trong `USER_ALLOW_CIDR` server-side.
- **Hook block khi không muốn**: bỏ `ONEMCP_HOOK_STRICT=1`. Advisory mode không block.
