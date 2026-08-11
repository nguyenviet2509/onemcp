# OneMCP Admin Runbook

Vận hành hàng ngày cho dept-admin: approve project mới, troubleshoot sync, rotate secrets, monitor.

## Approve project mới (multi-project skills registry)

Dev đăng ký project qua portal `/projects` → status `pending`. Dept-admin duyệt:

1. Login portal `https://oneconnector.000nethost.com/`
2. `/projects` → filter status=pending → chọn project
3. Verify:
   - Project name không trùng
   - Git repo URL đúng (HTTPS, có deploy_token) hoặc SSH key added
   - Scope (public/dept/private) hợp lý cho project
   - Owner user đúng dept
4. Nhấn **Approve** → backend:
   - Sinh webhook secret HMAC
   - Push đầu tiên vào skills-<project> repo trigger sync
   - Skills xuất hiện trong dept scope theo visibility flag
5. Nhấn **Reject** nếu spam/duplicate → status = rejected, dev nhận notification portal

Reject không xóa entity, chỉ set status. Dev có thể resubmit sau khi fix.

## Sync troubleshoot

**Symptom: Skills không xuất hiện sau khi push git**

1. Check webhook nhận được:
   ```bash
   ssh onemcp-vps "docker logs onemcp-backend-1 --since 10m 2>&1 | grep -i webhook | tail -20"
   ```
2. Verify HMAC signature match (backend log sẽ show "invalid signature" nếu sai)
3. Check BullMQ queue backlog:
   ```bash
   ssh onemcp-vps "docker exec onemcp-redis-1 redis-cli LLEN 'bull:skill-sync:wait'"
   ```
4. Nếu queue empty nhưng skill vẫn thiếu: check git mirror trên VPS:
   ```bash
   ssh onemcp-vps "ls -la /var/lib/onemcp/mirrors/<project-slug>/"
   ```
5. Manual resync: xóa mirror + trigger cron:
   ```bash
   ssh onemcp-vps "rm -rf /var/lib/onemcp/mirrors/<project> && docker exec onemcp-backend-1 curl -X POST http://localhost:3000/api/admin/sync/<project>"
   ```

**Symptom: BullMQ worker crash**

```bash
ssh onemcp-vps "docker logs onemcp-backend-1 --tail 200 2>&1 | grep -Ei 'skill-sync|BullMQ|worker'"
docker compose restart backend  # nếu worker dead
```

## Rotate secrets

### Backend `ONEMCP_ENCRYPTION_KEY` (rare — chỉ khi compromise)

Rotate = re-encrypt ALL stored OAuth secrets. Downtime ~5 min.

```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -hex 32)

# 2. Backup DB
ssh onemcp-vps "docker exec onemcp-postgres-1 pg_dump -U onemcp onemcp > /opt/onemcp/backups/pre-rotate-$(date +%F).sql"

# 3. Run migration script (manual — chưa tự động)
# TODO: script re-encrypt oauth_clients.client_secret_hash + connector tokens
# For now: khuyến nghị KHÔNG rotate trừ khi thực sự compromise
```

### Zitadel client_secret

Rotate qua Zitadel console → OneMCP app → regenerate secret → update `ops/oauth2-proxy/oauth2-proxy.cfg` trên VPS → `docker compose restart oauth2-proxy`.

### GitLab mirror token (cũ, khi còn dùng)

Update `.env` `GITLAB_MIRROR_TOKEN` → `docker compose restart backend`.

## Cert renewal (Sectigo wildcard — Feb 2027)

Cert `*.000nethost.com` valid tới 2027-02-20. Manual renew:

1. Provider (000nethost / Sectigo reseller) cấp bundle mới: `.crt` + `.key` + `rootca.crt`
2. Rebuild fullchain (Python — strip CRLF, ensure blank line giữa 2 certs):
   ```python
   import re
   out = []
   for f in ['star_000nethost_com_certificate.crt', 'star_000nethost_com_rootca.crt']:
       txt = open(f, 'rb').read().decode().replace('\r\n', '\n').replace('\r', '\n')
       for m in re.finditer(r'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----', txt, re.DOTALL):
           out.append(m.group(0))
   open('fullchain.pem', 'w', newline='\n').write('\n'.join(out) + '\n')
   ```
3. Deploy:
   ```bash
   scp fullchain.pem onemcp-vps:/opt/onemcp/ops/nginx/tls/oneconnector.fullchain.pem
   scp privkey.key onemcp-vps:/opt/onemcp/ops/nginx/tls/oneconnector.key
   ssh onemcp-vps "sed -i 's/\r$//' /opt/onemcp/ops/nginx/tls/oneconnector.* && docker compose restart nginx"
   ```
4. Verify: `curl https://oneconnector.000nethost.com/health` — cert phải valid, không schannel error.

## Emergency lockdown

Chặn toàn bộ traffic (trả 503 mọi endpoint trừ `/health`):
```bash
ssh onemcp-vps "cd /opt/onemcp && sed -i 's/^EMERGENCY_LOCKDOWN=false/EMERGENCY_LOCKDOWN=true/' .env && docker compose restart backend"
```

Tắt riêng AI Connector (giữ portal + built-in tools):
```bash
ssh onemcp-vps "cd /opt/onemcp && sed -i 's/^MCP_AUTH_MODE=required/MCP_AUTH_MODE=off/' .env && docker compose restart backend"
```

## Daily / weekly health checks

**Daily (5 phút):**
- Portal `/health` = 200
- Backend `/health`, `/ready` = 200
- MCP DCR count không spike (rate limit 5/hour/IP)
- Audit log không có error spike

**Weekly:**
- BullMQ queue sạch (không có job stuck > 1h)
- Redis DBSIZE ổn định
- Backup script chạy hàng ngày (`ops/backup/`)
- Cert expiry > 60 ngày (nếu < 30 ngày: kick renewal ngay)

## References

- Onboarding client: [ai-client-onboarding.md](./ai-client-onboarding.md)
- OAuth troubleshoot: [oauth-troubleshoot.md](./oauth-troubleshoot.md)
- System architecture: [system-architecture.md](./system-architecture.md)
- Ops onboarding: [onboarding-ops.md](./onboarding-ops.md)
