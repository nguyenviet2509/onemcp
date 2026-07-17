# Cook Session 12 — P6 Part 1: Prometheus Metrics + Backups + Deep Ready

**Date:** 2026-07-17 · **Phase:** P6 Hardening · **Progress:** ~40% P6 complete

## Scope

Production readiness essentials:
- Prometheus metrics endpoint + HTTP instrumentation
- Deep readiness check (Postgres + MinIO reachability)
- Daily backup service (pg_dump + MinIO mirror) với retention

**Deferred P6.2**: alerting rules deploy, backup age metric, log rotation, resource limits, auth v2 prep.

## Delivered — Backend

### Metrics module (`metrics/`)
- `metrics.service.ts` — Prometheus Registry với `collectDefaultMetrics` + 5 app metrics:
  - `onemcp_http_requests_total` counter (method/route/status)
  - `onemcp_http_request_duration_seconds` histogram (buckets 10ms→10s)
  - `onemcp_artifact_submits_total` counter (type/result)
  - `onemcp_skill_loads_total` counter (skill)
  - `onemcp_mcp_tool_calls_total` counter (tool/result)
- `metrics.middleware.ts` — auto-instrument all HTTP req. Route normalize `/api/artifacts/:id` (replace numeric segments) chống cardinality explosion.
- `metrics.controller.ts` — `GET /metrics` text/plain Prometheus format.
- `metrics.module.ts` — @Global. Configure middleware forRoutes('*').

### Health improvements
- `/ready` — deep check: `SELECT 1` Postgres + `bucketExists` MinIO. Trả 503 nếu 1 trong 2 fail.
- Redis không check (BullMQ tự retry — không block ready).
- `MinioService.ping()` helper.

### Access bypass
- `IpCidrGuard`, `TrustUserMiddleware` bypass `/metrics` — cần thiết cho Prometheus scrape từ internal net.
- `main.ts` setGlobalPrefix exclude thêm `metrics`.

Deps: `prom-client@^15.1.3`.

Build: `pnpm build` clean ✅.

## Delivered — Ops

### Backup service (`ops/backup/`)
- `backup.sh` — pg_dump `-Fc -Z 6` (compressed custom format) + `mc mirror` MinIO → tarball. Retention prune `BACKUP_RETAIN_DAYS` (default 14).
- `Dockerfile` — alpine + postgres16-client + mc (curl từ dl.min.io) + crond.
- docker-compose.yml thêm service `backup` depends postgres/minio healthy, bind mount `./backups`.
- Env: `BACKUP_CRON` (default `0 3 * * *`), `BACKUP_RETAIN_DAYS=14`.

## Delivered — Docs

- `docs/backup-restore.md` — auto backup layout, restore Postgres + MinIO steps, off-site 3-2-1 recommend, restore test schedule.
- `docs/monitoring.md` — Prometheus scrape config, 5 metrics documented, Grafana panel PromQL samples (latency p95, error rate, KB submits, adoption), alerting rules.

## Files
- Backend new: 4 (metrics x4)
- Backend modified: 5 (app.module, main, ip-guard, trust-middleware, health.controller, minio.service)
- Ops new: 2 (backup.sh + Dockerfile)
- Compose modified: 1 (add backup service)
- Env: .env.example
- Docs: 2 (backup-restore.md + monitoring.md)

Total ~15 files.

## Deploy staging

```bash
cd /opt/onemcp
git pull

mkdir -p /opt/onemcp/backups   # bind mount host dir
chown $USER:$USER /opt/onemcp/backups

docker compose build backend backup
docker compose up -d
docker compose logs backend --tail=20 | grep -E "metrics|listening"
docker compose logs backup --tail=10
```

## Verify

```bash
# 1. /metrics endpoint
curl -sk https://onemcp.local/metrics | head -30
# Expect: # HELP onemcp_* + # TYPE + values

# 2. /ready deep check
curl -sk https://onemcp.local/ready | jq
# Expect: {"status":"ready","checks":{"postgres":true,"minio":true}}

# 3. Trigger backup manual
docker compose exec backup /usr/local/bin/backup.sh
ls -lh /opt/onemcp/backups/
# Expect: folder <TS>/ với postgres.dump + minio.tar.gz

# 4. Check cron installed
docker compose exec backup crontab -l -u root

# 5. Simulate broken Postgres — /ready 503
docker compose stop postgres
sleep 5
curl -sk -o /dev/null -w "%{http_code}\n" https://onemcp.local/ready
# Expect: 503
docker compose start postgres

# 6. HTTP instrumentation — hit few endpoints, check counter tăng
curl -sk https://onemcp.local/api/health  # hoặc bất kỳ
curl -sk https://onemcp.local/metrics | grep http_requests_total | head -5
```

## Prometheus quickstart (optional local prom)

```bash
docker run --rm -p 9090:9090 \
  --network onemcp_default \
  -v $(pwd)/ops/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
# Open http://localhost:9090 → targets → onemcp-backend UP
```

## Design choices

- **prom-client stdlib**: single lib, mature, low overhead. Không dùng OpenTelemetry — overkill cho pilot.
- **Histogram buckets** 10ms-10s covers typical Nest req + healthy tail. Adjust nếu latency thực tế lệch.
- **Route normalize** ở middleware layer — regex `\d+` → `:id`. Đủ cho REST convention hiện tại; nếu tương lai có UUID path, add regex.
- **Backup tarball** thay full incremental — simple, tolerable size cho pilot (10s of MB). Chuyển sang mc replicate hoặc pgBackRest khi > 1GB.
- **/ready deep vs shallow**: MinIO bucketExists rẻ (< 10ms), Postgres SELECT 1 rẻ. Đủ nhanh cho k8s-style readinessProbe every 10s.
- **Redis không check**: BullMQ tự reconnect + retry, không phải blocker cho serving artifact/skill reads.

## Next (P6 Part 2)

- [ ] Backup age metric — `onemcp_backup_last_success_seconds` (backup script POST tới `/api/internal/backup-hook`)
- [ ] Log rotation — pino tunneling qua vector/logrotate
- [ ] Docker resource limits (`mem_limit`, `cpus`) trong compose
- [ ] Off-site backup rclone/systemd timer config
- [ ] Rate limit tuning per-endpoint (search/upload/mcp có different profile)
- [ ] Graceful shutdown — Nest signals, drain BullMQ workers
- [ ] Auth v2 prep — extension point cho JWT/OIDC middleware swap

## Unresolved

- **Backup on VPS-only**: nếu VPS chết cả disk → mất backups luôn. Cần off-site mirror (rclone → S3/NAS). Doc'd trong docs/backup-restore.md nhưng chưa auto.
- **Prometheus tự host**: session này expose /metrics nhưng chưa deploy Prometheus. Ops team cần setup + scrape config.
- **/metrics no auth**: bypass CIDR + trust header. Nginx location restrict là mitigation duy nhất — chưa apply. Add nginx rule cho `location = /metrics { allow prometheus-ip; deny all; }` khi deploy Prom.
- **Counters wire chưa xong**: infrastructure sẵn nhưng chưa wire vào ArtifactsService/SkillsService/McpController. Session 12.1 sẽ wire → deprecated placeholders "artifact submits" giữ 0.
- **Backup dockerfile mỗi lần build cần curl mc** — nếu dl.min.io downtime → build fail. Cache image sau first build ok.

## Session Metrics
- Files new: 8 (backend 4 + ops 2 + docs 2)
- Files modified: 7
- LOC delta: ~500
- New endpoints: 1 (`/metrics`)
- New services: 1 (`backup` container)
- Backend build: ✅ clean
