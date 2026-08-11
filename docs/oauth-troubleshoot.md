# OAuth 2.1 + MCP Troubleshoot

Lỗi thường gặp khi cắm AI client vào `https://oneconnector.000nethost.com/mcp/`.

## Bảng chẩn đoán nhanh

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `EADDRINUSE 127.0.0.1:<port>` khi start mcp-remote | Windows TIME_WAIT giữ port ~2 min sau khi close | Kill process cũ trên port đó, hoặc bỏ fixed port (dùng random). Nếu vẫn fail: chờ 2 phút hoặc reboot |
| `Unexpected content type: text/html; charset=utf-8` | Client gọi endpoint sai (`/api/mcp` thay vì `/mcp/`) → nginx auth_request redirect HTML | Config đúng URL `https://oneconnector.000nethost.com/mcp/` (có trailing slash) |
| `Authorization error: ServerError` sau khi user Allow | DCR race — 2 mcp-remote processes tạo 2 client_id khác nhau, token exchange dùng sai client | Backend đã dedup 60s (fix commit `635a166`). Nếu vẫn fail: clean `~/.mcp-auth/` + retry |
| `invalid or expired code` ở token endpoint | Code TTL 60s hết hạn, hoặc user consent quá lâu | Retry OAuth flow từ đầu |
| `client_id mismatch` ở token endpoint | mcp-remote cache DCR cũ, sau đó DCR lại → cache overwrite | Xoá `~/.mcp-auth/mcp-remote-*/client_info.json` + retry |
| `PKCE verification failed` | `code_verifier` không match `code_challenge` (client bug) | Update mcp-remote lên latest, hoặc check MCP client SDK version |
| `Server disconnected` sau init | Backend `MCP_AUTH_MODE=required` nhưng Bearer sai/thiếu | Xoá token cache `~/.mcp-auth/mcp-remote-*/tokens.json` → retry OAuth |
| Cert error `UNTRUSTED_ROOT` (Windows schannel) | Windows root store thiếu USERTrust RSA | Update Windows root certificates hoặc dùng OpenSSL client |
| `401 Bearer error="missing_token"` | Client không gửi `Authorization: Bearer` header | Verify mcp-remote đã hoàn tất OAuth (tokens.json tồn tại) |
| `401 Bearer error="invalid_token"` | Token expired (TTL 1h) và refresh cũng fail | Xoá `tokens.json` → retry OAuth. Bug refresh rotation nếu lặp |
| Consent screen redirect loop | Zitadel session hết hạn hoặc email format sai | Check oauth2-proxy log, verify Zitadel `preferred_username` claim tồn tại |
| Consent screen 404 `/oauth-consent` | Portal chưa rebuild với batch consent screen | `docker compose up -d --build portal` trên VPS |

## Lấy debug info

**Claude Desktop log:**
```powershell
Get-Content "$env:LOCALAPPDATA\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\logs\mcp-server-onemcp.log" -Tail 100
```

**mcp-remote cache:**
```powershell
Get-ChildItem "$env:USERPROFILE\.mcp-auth" -Recurse -File | Format-Table FullName, LastWriteTime
```

**Backend OAuth log (SSH admin):**
```bash
ssh onemcp-vps "docker logs onemcp-backend-1 --since 5m 2>&1 | grep -Ei 'DCR|oauth|token|PKCE' | tail -20"
```

**Redis token store:**
```bash
ssh onemcp-vps "docker exec onemcp-redis-1 redis-cli KEYS 'oauth:*'"
```

## Reset toàn bộ OAuth state (client-side)

```powershell
# Windows
Get-Process claude,node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item "$env:USERPROFILE\.mcp-auth\mcp-remote-*\*" -Force -Recurse
# Relaunch Claude Desktop → sẽ redo full DCR + OAuth flow
```

```bash
# macOS/Linux
pkill -f Claude ; pkill -f mcp-remote
rm -rf ~/.mcp-auth/mcp-remote-*/*
```

## Enable debug log (admin, SSH)

```bash
ssh onemcp-vps "cd /opt/onemcp && sed -i 's/^LOG_LEVEL=info/LOG_LEVEL=debug/' .env && docker compose restart backend"
# Xem log
ssh onemcp-vps "docker logs onemcp-backend-1 -f 2>&1 | grep -i oauth"
# Nhớ tắt lại sau khi debug xong
```

## Emergency rollback

Tắt hoàn toàn OAuth flow (dev only — fallback trust-header):
```bash
ssh onemcp-vps "cd /opt/onemcp && sed -i 's/^MCP_AUTH_MODE=required/MCP_AUTH_MODE=off/' .env && docker compose up -d --force-recreate backend"
```
