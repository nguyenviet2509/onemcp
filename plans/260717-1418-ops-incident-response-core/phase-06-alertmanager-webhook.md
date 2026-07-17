---
phase: 06
name: Alertmanager webhook → KB/runbook suggest
status: completed
effort: 1.5 day
priority: P0
depends: [phase-03]
---

# Phase 06 — Alertmanager webhook → KB/runbook suggest

## Context

Alert fire → thường ops mở laptop tìm runbook thủ công. Auto-suggest → giảm MTTR đáng kể. Alertmanager POST vào OneMCP → OneMCP search runbook/KB → post kết quả về Slack channel `#kythuat-oncall`.

## Requirements

**Functional:**
- Endpoint `POST /api/webhooks/alertmanager` — receive Alertmanager payload
- Payload parse: `alerts[]` array, mỗi alert có `labels.alertname`, `labels.service`, `labels.severity`, `annotations.summary`
- Cho mỗi alert `status=firing`:
  - Build query: `${alertname} ${service} ${summary}`
  - Gọi `SearchService.search()` với `service=labels.service`, limit=3
  - Filter results: runbook type first
  - Compose Slack message: alert summary + top 3 links (portal URL)
  - POST Slack incoming webhook
- Dedup: hash `groupKey` từ payload, cache 5min, skip repeat trong window
- Rate limit endpoint (10/min per IP) — Alertmanager không spam
- Auth: HMAC-SHA256 header `X-Alertmanager-Token` (reuse `HmacGuard` pattern từ GitLab webhook)

**Non-functional:**
- Slack webhook URL env `SLACK_ONCALL_WEBHOOK_URL`
- HMAC secret env `ALERTMANAGER_WEBHOOK_SECRET`
- Timeout Slack POST 5s, fire-and-forget (không block Alertmanager)
- Metrics: `onemcp_alert_matches_total{alertname, matched=true|false}`

## Related files

**Create:**
- `backend/src/webhooks/alertmanager.controller.ts` — endpoint
- `backend/src/webhooks/alertmanager.service.ts` — parse + query + Slack post
- `backend/src/webhooks/alertmanager-hmac.guard.ts` — reuse HMAC pattern
- `backend/src/webhooks/slack.service.ts` — thin wrapper POST webhook
- `backend/src/webhooks/dedup-cache.service.ts` — in-memory 5min Map với TTL

**Modify:**
- `backend/src/webhooks/webhooks.module.ts` — register new controller + services
- `backend/src/access/ip-cidr.guard.ts` — bypass `/api/webhooks/*` (đã có)
- `backend/src/metrics/metrics.service.ts` — thêm counter `alertMatches`
- `.env.example` — thêm 2 env vars
- `ops/nginx/nginx.conf` — optional whitelist Alertmanager IP nếu deploy internal

## Alertmanager config sample

```yaml
receivers:
- name: onemcp-suggest
  webhook_configs:
  - url: https://onemcp.local/api/webhooks/alertmanager
    http_config:
      tls_config:
        insecure_skip_verify: true
    send_resolved: false
    max_alerts: 5

route:
  routes:
  - match:
      severity: page
    receiver: onemcp-suggest
    continue: true
```

## Slack message format

```
🚨 Alert: {alertname} ({severity})
Service: {service}
Summary: {annotations.summary}

📚 Related runbooks/KBs từ OneMCP:
1. [runbook] Postgres disk recovery — https://onemcp.local/artifacts/12
2. [kb] Redis OOM eviction fix — https://onemcp.local/artifacts/45
3. [runbook] Nginx 502 troubleshoot — https://onemcp.local/artifacts/23
```

Nếu 0 matches: `📚 OneMCP: Không tìm thấy runbook/KB liên quan. Cân nhắc tạo runbook mới sau khi giải quyết.`

## Implementation steps

1. HMAC guard reuse (extract từ gitlab-hmac.guard pattern)
2. `dedup-cache.service.ts` — simple Map + setTimeout cleanup
3. `slack.service.ts` — fetch POST wrapper
4. `alertmanager.service.ts`:
   ```typescript
   async handle(payload) {
     for (const alert of payload.alerts) {
       if (alert.status !== 'firing') continue;
       if (this.dedup.has(payload.groupKey)) continue;
       this.dedup.add(payload.groupKey);

       const q = `${alert.labels.alertname} ${alert.labels.service || ''} ${alert.annotations?.summary || ''}`;
       const hits = await this.search.search(SYSTEM_USER, { q, service: alert.labels.service, limit: 3 });
       this.metrics.alertMatches.inc({ alertname: alert.labels.alertname, matched: hits.length > 0 ? 'true' : 'false' });
       await this.slack.post(formatMessage(alert, hits));
     }
   }
   ```
5. Controller wire
6. Env config + .env.example
7. Test qua curl mock payload:
   ```bash
   curl -X POST -H "X-Alertmanager-Token: $HMAC" -H "Content-Type: application/json" \
     https://onemcp.local/api/webhooks/alertmanager \
     -d @test-alert-payload.json
   ```
8. Verify Slack message post + metrics

## Todo

- [ ] HMAC guard reuse
- [ ] Dedup cache service
- [ ] Slack service wrapper
- [ ] Alertmanager service parse + search + post
- [ ] Controller endpoint
- [ ] Register module + metrics counter
- [ ] .env.example
- [ ] SYSTEM_USER identity cho SearchService.search (bypass dept filter cross-dept? or set default dept=kythuat)
- [ ] Test payload curl E2E
- [ ] Verify dedup work (2 curl consecutive → chỉ 1 Slack post)
- [ ] Docs `docs/alertmanager-integration.md`

## Success criteria

- Fire test alert `alertname=PostgresDiskFull service=postgres` → Slack thread trong 30s có 3 runbook link
- Dedup: 2 alerts cùng groupKey trong 5min → chỉ 1 Slack post
- Metrics `onemcp_alert_matches_total{alertname="PostgresDiskFull",matched="true"} 1`
- HMAC verify: request không có header hoặc sai → 401

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Slack webhook down → block Alertmanager | LOW | Timeout 5s + fire-forget promise, error log only |
| Search return irrelevant results | MED | Log query + hits, tune Phase 03 boost sau feedback |
| Dedup cache reset on restart → duplicate | LOW | 5min window đủ ngắn, restart hiếm khi incident |
| Alertmanager retry on 5xx → duplicate | LOW | Ensure endpoint idempotent (dedup handles) |
| Cross-dept auth: SYSTEM_USER là ai? | MED | Tạo virtual user `system:alertmanager` với role viewer default dept kythuat |

## Notes

- **Không extend dedup** thành Redis distributed — 1 backend replica pilot, in-memory OK.
- **Không auto-create incident** trong OneMCP — Phase sau nếu pilot cần incident tracking.
- **Không post kết quả về portal UI notification** — Slack đủ. Portal notification là backlog Phase 3.
- SYSTEM_USER cần bypass IP CIDR check (endpoint đã whitelist), nhưng dept scoping vẫn giữ.

## Red Team Redlines (2026-07-17)

- **[RT-1, Critical] Alertmanager cannot HMAC-sign webhook bodies natively.** `webhook_configs` supports only `basic_auth` / `authorization` / `tls_config`. "Reuse `HmacGuard` from GitLab webhook" DOES NOT WORK — GitLab signs the body, Alertmanager does not. Fix:
  - Use `authorization: Bearer <secret>` in Alertmanager `http_config` + constant-time compare in the new guard (NOT reused HmacGuard).
  - Require TLS with proper CA (`ca_file`); REMOVE `insecure_skip_verify: true` from the sample config.
  - Add IP allowlist for the webhook path at nginx (make ops/nginx step REQUIRED not optional).
  - Update `.env.example` var name from `ALERTMANAGER_WEBHOOK_SECRET` (HMAC connotation) to `ALERTMANAGER_WEBHOOK_TOKEN`.

<!-- Updated: Validation Session 1 (V4) — CONFIRMED: Bearer token + TLS(ca_file) + nginx IP allowlist. All three required. Drop `insecure_skip_verify`. Rename env var. -->
<!-- Updated: Validation Session 1 (V2) — SYSTEM_USER: add `bypassDeptFilter: true` param to SearchService.search(), gated on system role. Username `system-alertmanager` (regex-safe). Explicit test: forge alert w/ non-kythuat keyword → assert Slack payload does NOT contain that artifact's URL. AND: non-system caller passing `bypassDeptFilter=true` → 403. -->
- **[RT-2, Critical] SYSTEM_USER cross-dept behavior must be decided + tested BEFORE Phase 06 dev.** Two problems:
  1. Trust-header regex `^[a-z0-9._-]{2,32}$` rejects `system:alertmanager` (contains `:`). Use `system-alertmanager`.
  2. Dept scoping: if kept as `dept=kythuat`, cross-dept runbooks (e.g. shared infra) never match → Slack posts "no runbook" while one exists. Add `bypassDeptFilter: true` option to `SearchService.search()` gated on system role, OR route alerts by `labels.department` to that dept's scope. **Move this from `Todo` to `Requirements`** and add explicit acceptance test: forge alert containing keywords of a known non-kythuat artifact → assert Slack payload does NOT contain that artifact's URL.
- **[RT-6, High] Slack payload injection via untrusted Alertmanager labels.** `${alertname} ${service} ${summary}` interpolates attacker-controllable strings (anyone with Prometheus push access can set labels/annotations) directly into Slack `mrkdwn`. Attacker sets `annotations.summary = "<!channel> Ops click http://phish|onemcp-portal"` → OneMCP pages the entire channel with a phishing link. Fix:
  - Escape Slack control chars (`<`, `>`, `&`).
  - Strip/reject `@channel`, `@here`, `<!channel>`, `<!here>`, `<!subteam^...>` tokens.
  - Cap label/annotation length (e.g. 200 chars).
  - Whitelist `alertname` against `^[A-Za-z0-9_-]+$` — reject or sanitize if fails.
- **[RT-7, High] Dedup design is broken in multiple ways.**
  - `payload.groupKey` is client-supplied → attacker (or misconfigured pipeline) randomizes it to defeat dedup entirely.
  - In-memory Map is process-local → restart during a real incident replays every currently-firing alert (Alertmanager `repeat_interval` re-sends).
  - Dedup added BEFORE Slack POST → Slack 429/500 causes silent alert drop.
  - Same `groupKey` for all alerts in a payload → first-alert-wins suppresses new sibling alerts.
  - **Fix:** dedup key = server-computed `sha256(alertname + service + sorted-labels + startsAt)` per alert, persisted in Postgres (`INSERT ... ON CONFLICT DO NOTHING`, TTL 4h aligned with default `repeat_interval`, configurable). Insert AFTER Slack 2xx.
- **[RT-8, High] 5xx retry storm — return 2xx immediately.** If `SearchService` throws (DB down mid-incident), controller returns 500 → Alertmanager retries every ~1min → each retry re-executes the search → worsens the outage. Fix: validate + HMAC check → respond `202 Accepted` → process async. On downstream failure post a minimal Slack message ("Alert received; KB lookup failed") so ops still get notified. Never let downstream failures cause Alertmanager retries.
- **[RT-9, High] Rate limit 10/min per IP will drop legitimate cascading-alert bursts.** All Alertmanager traffic comes from one pod IP → correlated outage with 20 alert groups gets 429'd at alert 11. Fix: raise to ≥200/min for authenticated webhook path OR bypass rate limit when auth token verifies OR limit per-groupKey diversity not raw request count. Configure `trust proxy` + `X-Forwarded-For` handling explicitly.
- **[Related — Secret handling]** Slack incoming webhook URL is itself a secret (anyone with URL can post to `#kythuat-oncall`). Load `SLACK_ONCALL_WEBHOOK_URL` + `ALERTMANAGER_WEBHOOK_TOKEN` from a secret manager or docker/k8s secrets, not raw `.env`. Document rotation runbook (seed as a real runbook to eat own dogfood). Add anomaly-alert on Slack post rate (>N/min → log + counter).
