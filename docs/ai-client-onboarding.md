# AI Client Onboarding — OneMCP AI Connector

Hướng dẫn cắm AI client (Claude Desktop, Cursor, ChatGPT, mcp-remote CLI) vào OneMCP MCP Gateway qua OAuth 2.1 + DCR.

**Endpoint:** `https://oneconnector.000nethost.com/mcp/`
**Auth:** OAuth 2.1 (DCR + PKCE S256) + Bearer token (opaque, TTL 1h + refresh rotation)
**Scope:** `mcp` (call tools + đọc skills/artifacts trong dept của user)

## Claude Desktop

**Config file** (`%APPDATA%\Claude\claude_desktop_config.json` trên Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` trên macOS):

```json
{
  "mcpServers": {
    "onemcp": {
      "command": "npx.cmd",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://oneconnector.000nethost.com/mcp/",
        "--transport",
        "http-only"
      ]
    }
  }
}
```

**Lưu ý:** `npx.cmd` trên Windows, `npx` trên macOS/Linux.

Quit + relaunch Claude Desktop → mcp-remote tự DCR + PKCE + mở browser cho consent. Sau Allow: server card `onemcp` chuyển sang `running` với 8 tools.

## Cursor

Cursor Settings → MCP → Add server:
- **Name:** onemcp
- **Command:** `npx`
- **Args:** `-y mcp-remote@latest https://oneconnector.000nethost.com/mcp/ --transport http-only`

## mcp-remote CLI (test / dev)

```bash
npx -y mcp-remote@latest https://oneconnector.000nethost.com/mcp/ --transport http-only
```

Token cache tại `~/.mcp-auth/mcp-remote-<version>/` — giữ để skip OAuth flow trên retry.

## OAuth flow (tự động qua mcp-remote)

1. `GET /.well-known/oauth-authorization-server` → discover AS
2. `POST /api/oauth/register` (RFC 7591 DCR) → nhận `client_id`
3. Redirect browser → `/api/oauth/authorize?client_id=...&code_challenge=...`
4. User login qua Zitadel SSO (nếu chưa có session)
5. Redirect sang `/oauth-consent` → user nhấn Allow
6. Callback về `http://localhost:<port>/oauth/callback?code=...`
7. `POST /api/oauth/token` với `code_verifier` → nhận `access_token` + `refresh_token`
8. Tất cả request tới `/mcp/*` gửi kèm `Authorization: Bearer <access_token>`

## Available tools (8)

| Tool | Purpose |
|---|---|
| `list_skills` | Liệt kê skills theo tag/query |
| `load_skill` | Đọc SKILL.md content (inject vào agent context) |
| `list_artifacts` | Liệt kê artifact (report/kb/postmortem/runbook) |
| `get_artifact` | Đọc artifact theo id |
| `get_artifact_template` | Template sections cho artifact type |
| `search` | Hybrid search skills + artifacts |
| `submit_artifact` | Submit artifact mới (pending review) |
| `load_runbook` | Load operational runbook theo tên/service |

## Verify

Sau khi cắm xong, hỏi Claude:
> "Dùng tool `list_skills` của onemcp để liệt kê skills"

Nếu Claude gọi được tool và trả kết quả → thành công.

## Troubleshoot

Xem [oauth-troubleshoot.md](./oauth-troubleshoot.md) cho các lỗi phổ biến (EADDRINUSE, DCR race, token expired, cert error).
