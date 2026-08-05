# OneMCP GitLab SSO — Emergency Rollback Runbook

**Purpose:** Chỉ dẫn nhanh để rollback khỏi SSO về trust-header auth khi gặp sự cố.

**Scope:** Production onemcp-vps chỉ. Lab rollback không cần (dữ liệu throw-away).

---

## Khi nào rollback

Activate rollback nếu **BẤT CỨ MỘT** điều sau xảy ra trong **5 phút đầu sau cutover**:

| Trigger | Ngưỡng | Hành động |
|---|---|---|
| Portal 5xx error rate | > 5% trong 5 phút | Rollback ngay |
| Backend `oauth_code_exchange_failed` | > 10 err/phút | Rollback ngay |
| User report "login fail" | > 3 ticket trong 15 phút | Assess → rollback nếu hệ thống issue |
| GitLab API timeout | > 3 lần liên tiếp | Rollback (likely network) |

**Quyết định nhanh:** Nếu bạn không chắc, rollback trước → ask later.

---

## Emergency rollback (≤ 5 phút)

**Mục tiêu:** Quay lại trust-header mode nhanh nhất, zero downtime.

### Step 1: SSH vào onemcp-vps

```bash
ssh -i <your-key> deploy@<onemcp-vps-ip>
# Hoặc nếu có .ssh/config:
ssh onemcp-vps
```

### Step 2: Tắt SSO env

```bash
cd /opt/onemcp

# Chỉnh 2 biến:
sudo sed -i 's/^AUTH_MODE=.*/AUTH_MODE=trust-header/' .env
sudo sed -i 's/^NEXT_PUBLIC_AUTH_MODE=.*/NEXT_PUBLIC_AUTH_MODE=trust-header/' .env

# Verify:
grep "^AUTH_MODE\|^NEXT_PUBLIC_AUTH_MODE" .env
# Expect:
# AUTH_MODE=trust-header
# NEXT_PUBLIC_AUTH_MODE=trust-header
```

### Step 3: Restart backend + portal

```bash
cd /opt/onemcp
docker compose up -d backend portal
```

**Wait for healthy state:**
```bash
docker compose ps
# Loop kiểm tra tới khi tất cả healthy (≤ 1 phút):
until docker compose ps | grep -q "backend.*healthy" && docker compose ps | grep -q "portal.*healthy"; do
  echo "Waiting... $(date)"
  sleep 5
done
echo "✓ Backend + portal healthy"
```

### Step 4: Verify legacy auth path works

```bash
# Từ VPS chính nó (trust-header path):
curl -sk https://localhost/api/artifacts \
  -H "X-Onemcp-User: testuser" \
  -H "Content-Type: application/json"

# Expect: 200 hoặc 401 (nếu không có data) — KHÔNG phải 403
# Nếu 403 → middleware vẫn bị SSO gate → KHÔNG DONE, debug tiếp
```

**Nếu 403:** Check logs:
```bash
docker compose logs backend --tail 50 | grep -i "auth\|403"
```

---

## Post-rollback verification (5-10 phút)

### Check portal không redirect /login

**From your machine (browser):**
```
https://202.92.5.113/
```

**Expect:** Portal hiển thị home page (mỗi request legacy logic parse header `X-Onemcp-User` từ reverse proxy / Load Balancer).

**Nếu vẫn redirect /login:** Portal ENV chưa reload. Check:
```bash
docker compose exec portal env | grep NEXT_PUBLIC_AUTH_MODE
# Expect: NEXT_PUBLIC_AUTH_MODE=trust-header

# Nếu vẫn gitlab-sso → force rebuild:
docker compose build portal
docker compose up -d portal
```

### Check bridge (OpenWebUI) still works

Bridge cũng dùng trust-header path. Quick test:
```bash
# Từ bridge container subnet (Docker bridge = 172.x):
curl -sk https://onemcp-backend:3000/api/artifacts \
  -H "X-Onemcp-User: openwebui-bot"

# Hoặc từ VPS chính:
curl -sk https://localhost/api/artifacts \
  -H "X-Onemcp-User: openwebui-bot"

# Expect: 200 / JSON array, KHÔNG 401/403
```

### Check API key path still works

```bash
# Tạm cấp API key (nếu chưa có test key):
# Hoặc dùng test key sẵn
TEST_KEY="omk_testkey123"

curl -sk https://localhost/api/artifacts \
  -H "X-Onemcp-Key: ${TEST_KEY}"

# Expect: 200, KHÔNG 401/403
```

### Check backend health

```bash
curl -sk https://localhost/api/health | jq .
# Expect: { "status": "ok", "mode": "v1-trust-header", ... }
```

---

## Session cleanup (tùy chọn)

**Mục tiêu:** Xóa SSO session cookies từ Redis (optional — auto-expire 24h).

Nếu muốn clear ngay (người dùng sẽ bị force logout):

```bash
cd /opt/onemcp
docker compose exec redis redis-cli --scan --pattern 'session:*' | xargs docker compose exec -T redis redis-cli del

# Hoặc chỉ clear OAuth state (temporary):
docker compose exec redis redis-cli --scan --pattern 'oauth_state:*' | xargs docker compose exec -T redis redis-cli del

# Verify:
docker compose exec redis redis-cli dbsize
# Expect: số lượng key giảm
```

**KHÔNG BẮT BUỘC:** Redis sẽ tự cleanup sau 24h. Skip nếu muốn user giữ session (seamless rollback).

---

## Post-mortem checklist

**Thực hiện sau khi rollback stabilize (30 min sau):**

### 1. Capture logs

```bash
# Backend logs từ 1h trước:
docker compose logs backend --since 1h > /tmp/rollback-backend-$(date +%s).log

# Portal logs:
docker compose logs portal --since 1h > /tmp/rollback-portal-$(date +%s).log

# Nginx:
docker compose logs nginx --since 1h > /tmp/rollback-nginx-$(date +%s).log

# Upload để lưu (nếu có log aggregation):
# gsutil -m cp /tmp/rollback-*.log gs://onemcp-logs/
```

### 2. Snapshot Prometheus metrics

```bash
# Từ một lúc SSO thành công tới rollback:
curl -s http://localhost:9090/api/v1/query_range?query=auth_login_fail_total&start=<timestamp-before>&end=<timestamp-after>&step=60s | jq > /tmp/metrics-auth-fail.json

curl -s http://localhost:9090/api/v1/query_range?query=http_request_duration_seconds_bucket&step=60s | jq > /tmp/metrics-latency.json
```

### 3. Document incident

Tạo issue ở OneMCP GitHub repo:

```
Title: [INCIDENT] SSO rollback — <timestamp>

Body:
- Rollback trigger: [Portal 5xx / GitLab API timeout / User complaints]
- Duration of SSO outage: [HH:MM]
- Time to rollback: [MM minutes]
- Root cause (if known): [...]
- Log files: [attached or link]
- Remediation for next time: [...]
- Next step: Post-mortem meeting on <date>
```

---

## Common causes + fixes

### GitLab API network timeout

**Symptom:** Backend logs `timeout connecting to gitlab.inet.vn`.

**Fix:**
1. **Verify iNET GitLab reachable từ prod VPS:**
   ```bash
   ssh onemcp-vps
   curl -v https://gitlab.inet.vn/api/v4/user --header "PRIVATE-TOKEN: <test-token>"
   ```

2. **Nếu fail:** Network / firewall issue ← iNET IT escalate.

3. **Temporary:** Rollback SSO (here) + schedule GitLab network test.

### Cookie SameSite / CORS rejection

**Symptom:** Browser console `Cookie blocked because ... same-site`.

**Fix:**
1. Check backend `CORS_ORIGINS` includes portal origin.
2. Check cookie `Secure` flag = true (enforce HTTPS).
3. Clear browser cookies + retry.
4. Nếu vẫn fail → rollback.

### Redis session store down

**Symptom:** Backend logs `redis connection refused` / `ECONNREFUSED`.

**Fix:**
```bash
# Check Redis health:
docker compose ps redis
docker compose logs redis --tail 20

# Restart Redis:
docker compose restart redis

# Nếu vẫn fail → rollback (session auth unavailable)
```

### OAuth app credentials invalid

**Symptom:** Backend logs `invalid_client_id` hoặc `invalid_client_secret`.

**Fix:**
1. Double-check `.env` GitLab OAuth credentials match GitLab admin panel.
2. Check credential rotation (iNET IT có revoke cũ?).
3. **Temporary:** Rollback.
4. Contact iNET GitLab admin regenerate credentials → update `.env`.

---

## Escalation

| Sự cố | Escalate tới | Kênh |
|---|---|---|
| Portal still 5xx sau rollback | Senior Dev | Slack #dev |
| Bridge continue broken | OneMCP Admin + OpenWebUI lead | Slack #ops |
| iNET GitLab API unreachable | iNET IT | Internal ticket system |
| Session Redis corrupted | DBA / Ops | Slack #ops |

---

## Rollback drill schedule

**Thực hiện hàng tháng (nên chọn thứ 2-3 sáng):**

1. **Rehearsal:** Follow steps 1-4 ở staging trước.
2. **Timing:** Record thời gian từ SSH tới "✓ Backend + portal healthy".
3. **Target:** ≤ 3 phút end-to-end.
4. **Report:** Post drill time + any friction ở #ops Slack.

---

## Reference

- **Rollback env keys:** `AUTH_MODE`, `NEXT_PUBLIC_AUTH_MODE`
- **Redis default TTL:** 86400s (24h)
- **Trust-header middleware:** `/backend/src/access/trust-user.middleware.ts`
- **Portal auth conditional:** `/portal/src/middleware.ts` checks `NEXT_PUBLIC_AUTH_MODE`
