# Alertmanager → OneMCP KB Suggest Integration

Khi alert fire, Alertmanager POST vào OneMCP webhook → OneMCP tự động search runbook/KB liên quan → post kết quả về Slack `#kythuat-oncall`.

## Architecture Flow

```
Alertmanager → POST /api/webhooks/alertmanager (Bearer token)
                        │
                        ▼ 202 ACK immediate (RT-8)
                 [async] AlertmanagerService.handle()
                        │
                   ┌────┴────┐
                   │  Dedup  │ sha256 fingerprint (Postgres, 4h TTL)
                   └────┬────┘
                        │ first-seen only
                   ┌────┴────┐
                   │ Search  │ SearchService.search() bypassDeptFilter=true
                   └────┬────┘
                        │
                   ┌────┴────┐
                   │  Slack  │ POST SLACK_ONCALL_WEBHOOK_URL (5s timeout)
                   └─────────┘
```

## Prerequisites

1. **ALERTMANAGER_WEBHOOK_TOKEN** — generate a strong random token:
   ```bash
   openssl rand -hex 32
   ```
   Set trong `.env` và trong Alertmanager receiver config.

2. **SLACK_ONCALL_WEBHOOK_URL** — tạo Incoming Webhook tại Slack App settings.
   URL format: `https://hooks.slack.com/services/T.../B.../...`
   Treat as secret — ai có URL có thể post vào channel.

3. **ONEMCP_ENABLE_OPS_TYPES=1** — feature flag phải bật mới post Slack.

4. TLS certificate hợp lệ trên OneMCP endpoint (Alertmanager yêu cầu `ca_file`).

## Alertmanager Receiver Config

```yaml
# alertmanager.yml
receivers:
- name: onemcp-suggest
  webhook_configs:
  - url: https://onemcp.internal/api/webhooks/alertmanager
    http_config:
      authorization:
        type: Bearer
        credentials: <ALERTMANAGER_WEBHOOK_TOKEN>
      tls_config:
        ca_file: /etc/alertmanager/tls/ca.crt   # CA cert của OneMCP TLS
        # insecure_skip_verify: true  ← NEVER use in production (V4)
    send_resolved: false
    max_alerts: 10

route:
  routes:
  - match:
      severity: page
    receiver: onemcp-suggest
    continue: true   # Continue to other receivers (PagerDuty, etc.)
  - match:
      severity: warning
    receiver: onemcp-suggest
    continue: true
```

## Nginx IP Allowlist (Required — V4)

Trong `ops/nginx/onemcp.conf`, uncomment geo block và location override:

```nginx
# Trong http context (bên ngoài server block):
geo $alertmanager_allowed {
  default      0;
  10.0.1.10/32 1;   # Alertmanager pod IP — thay bằng IP thực
  10.0.1.0/24  1;   # Hoặc CIDR nếu dùng nhiều replica
}

# Trong server block, thêm trước location /api/:
location /api/webhooks/alertmanager {
  if ($alertmanager_allowed = 0) {
    return 403 "IP not allowed";
  }
  set $backend_upstream backend;
  proxy_pass         http://$backend_upstream:3000;
  proxy_http_version 1.1;
  proxy_set_header   Host              $host;
  proxy_set_header   X-Real-IP         $remote_addr;
  proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
  proxy_set_header   X-Forwarded-Proto $scheme;
  proxy_read_timeout 30s;
}
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ALERTMANAGER_WEBHOOK_TOKEN` | YES | — | Bearer token, rotate quarterly |
| `SLACK_ONCALL_WEBHOOK_URL` | YES | — | Slack incoming webhook URL |
| `ONEMCP_ENABLE_OPS_TYPES` | YES | `0` | Feature flag — set `1` to enable |
| `ALERTMANAGER_DEDUP_TTL_MIN` | no | `240` | Dedup window in minutes (4h default) |
| `PUBLIC_API_URL` | no | `http://localhost/api` | Used to build artifact portal URLs in Slack |

## Test Curl Commands

### 1. Test auth — wrong token → 401
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://onemcp.internal/api/webhooks/alertmanager \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"alerts":[]}'
# Expected: 401
```

### 2. Test feature flag off → 202, no Slack post
```bash
# ONEMCP_ENABLE_OPS_TYPES=0 (default)
curl -s -X POST https://onemcp.internal/api/webhooks/alertmanager \
  -H "Authorization: Bearer $ALERTMANAGER_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "firing",
      "labels": {"alertname": "PostgresDiskFull", "service": "postgres", "severity": "page"},
      "annotations": {"summary": "Disk usage > 90% on postgres primary"},
      "startsAt": "2026-07-17T10:00:00Z"
    }],
    "groupKey": "test-group-1"
  }'
# Expected: {"accepted":true} — NO Slack post
```

### 3. Test full firing alert → Slack message
```bash
# ONEMCP_ENABLE_OPS_TYPES=1
curl -s -X POST https://onemcp.internal/api/webhooks/alertmanager \
  -H "Authorization: Bearer $ALERTMANAGER_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "PostgresDiskFull",
        "service": "postgres",
        "severity": "page"
      },
      "annotations": {
        "summary": "Disk usage > 90% on postgres primary node"
      },
      "startsAt": "2026-07-17T10:00:00Z",
      "fingerprint": "abc123"
    }],
    "groupKey": "alertname=PostgresDiskFull"
  }'
# Expected: {"accepted":true} + Slack message trong #kythuat-oncall trong <5s
```

### 4. Verify dedup — send identical payload twice
```bash
# Send same alert twice — chỉ 1 Slack message được gửi
PAYLOAD='{
  "alerts": [{
    "status": "firing",
    "labels": {"alertname": "RedisDiskFull", "service": "redis", "severity": "warning"},
    "annotations": {"summary": "Redis memory > 95%"},
    "startsAt": "2026-07-17T11:00:00Z"
  }]
}'

curl -s -X POST https://onemcp.internal/api/webhooks/alertmanager \
  -H "Authorization: Bearer $ALERTMANAGER_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

curl -s -X POST https://onemcp.internal/api/webhooks/alertmanager \
  -H "Authorization: Bearer $ALERTMANAGER_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

# Expected: 2x {"accepted":true} — chỉ 1 Slack message (dedup hit on 2nd)
```

### 5. Test Slack injection stripped
```bash
curl -s -X POST https://onemcp.internal/api/webhooks/alertmanager \
  -H "Authorization: Bearer $ALERTMANAGER_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "firing",
      "labels": {"alertname": "TestAlert", "service": "backend", "severity": "warning"},
      "annotations": {"summary": "<!channel> click <http://phish.example|onemcp>"},
      "startsAt": "2026-07-17T12:00:00Z"
    }]
  }'
# Expected: Slack message shows "[mention-stripped]" — no @channel ping
```

### 6. Test bad payload → 400
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://onemcp.internal/api/webhooks/alertmanager \
  -H "Authorization: Bearer $ALERTMANAGER_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"not_alerts": "wrong"}'
# Expected: 400
```

## Slack Message Format

```
🚨 Alert: PostgresDiskFull (page)
Service: postgres
Summary: Disk usage > 90% on postgres primary node

📚 Related runbooks/KBs từ OneMCP:
1. [runbook] Postgres Disk Recovery — https://onemcp.internal/artifacts/12
2. [kb] Postgres Maintenance Guide — https://onemcp.internal/artifacts/45
3. [runbook] Storage Alert Response — https://onemcp.internal/artifacts/23
```

Nếu không có kết quả:
```
📚 OneMCP: Không tìm thấy runbook/KB liên quan. Cân nhắc tạo runbook mới sau khi giải quyết.
```

## Metrics

| Metric | Labels | Description |
|---|---|---|
| `onemcp_alerts_received_total` | `flag=enabled\|disabled` | Alerts received (disabled = feature flag off) |
| `onemcp_alert_matches_total` | `alertname`, `matched=true\|false` | Search result posted to Slack |
| `onemcp_alert_slack_failures_total` | `alertname` | Slack POST failures |

Prometheus query để monitor:
```promql
# Alert rate per alertname
rate(onemcp_alert_matches_total[5m])

# Slack failure rate (alert if > 0 sustained)
rate(onemcp_alert_slack_failures_total[5m]) > 0

# Dedup effectiveness (% suppressed = 1 - matched/received)
1 - rate(onemcp_alert_matches_total[1h]) / rate(onemcp_alerts_received_total{flag="enabled"}[1h])
```

## Token Rotation Runbook

**Frequency:** Quarterly (mỗi 3 tháng) hoặc khi nghi ngờ bị lộ.

**Steps:**

1. Generate token mới:
   ```bash
   NEW_TOKEN=$(openssl rand -hex 32)
   echo "New token: $NEW_TOKEN"
   ```

2. Update OneMCP `.env` (hoặc k8s secret):
   ```bash
   kubectl create secret generic onemcp-secrets \
     --from-literal=ALERTMANAGER_WEBHOOK_TOKEN="$NEW_TOKEN" \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

3. Restart OneMCP backend để pick up new secret.

4. Update Alertmanager config với token mới:
   ```yaml
   http_config:
     authorization:
       credentials: <NEW_TOKEN>
   ```

5. Reload Alertmanager: `amtool alertmanager reload` hoặc `kubectl rollout restart`.

6. Verify với test curl (step 3 above).

7. Revoke old token (đã được replaced bởi restart).

**Rotation alert:** Thêm Prometheus alert nếu `onemcp_alert_slack_failures_total` tăng sau rotation — dấu hiệu token mismatch.

## Security Notes

- `SLACK_ONCALL_WEBHOOK_URL` và `ALERTMANAGER_WEBHOOK_TOKEN` là secrets — không commit vào git.
- Load từ Docker secrets, k8s Secrets, hoặc Vault — không dùng raw `.env` file trên production.
- IP allowlist ở nginx layer là defense-in-depth — Bearer token là primary auth.
- `insecure_skip_verify: true` bị cấm (V4) — luôn dùng `ca_file` với CA cert hợp lệ.
- Alertname bị whitelist `^[A-Za-z0-9_-]+$` — labels không khớp bị dropped silently (logged).
- Slack message content được escape mrkdwn + strip @mention tokens trước khi POST.
