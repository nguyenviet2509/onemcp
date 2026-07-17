# Phase 06 — Hardening & Ops

**Priority:** Medium
**Status:** pending
**Est.:** 1.5 tuần
**Depends on:** P1-P5

## Overview
Chuẩn bị pilot production: audit viewer, admin dashboard, backup/DR runbook, load test, security review, monitoring.

## VPS Specification (v1 pilot)

| Item | Spec |
|---|---|
| vCPU | 8 |
| RAM | 32 GB |
| Disk | 1 TB NVMe SSD |
| OS | Ubuntu 24.04 LTS |
| Kernel | ≥ 6.8 |
| SWAP | 8 GB |
| Network | Static internal IP, VPN-only, 200+ Mbps |
| Firewall | 443 (portal + MCP HTTPS), 22 SSH (IP whitelist) |

### RAM budget (32 GB)
| Service | Budget |
|---|---|
| Postgres 16 (shared_buffers 4GB, effective_cache 12GB, work_mem) | ~6 GB |
| Backend NestJS + embedding worker + ONNX e5-small in-memory | ~4 GB |
| Portal Next.js SSR | ~1.5 GB |
| Redis | 1 GB |
| MinIO | 1 GB |
| Nginx | 300 MB |
| Prometheus + Grafana + Alertmanager + exporters | ~2 GB |
| OS + Docker daemon | ~2 GB |
| Buffer / OS cache | ~14 GB |

### Disk layout (1 TB)
| Mount / usage | Size |
|---|---|
| OS + Docker images | 40 GB |
| Postgres data + WAL (`/var/lib/postgresql`) | 200 GB |
| MinIO attachments (`/var/lib/minio/attachments`) | 300 GB |
| MinIO backup bucket (PG dumps + WAL archive) | 300 GB |
| Git mirrors (skills repos) | 20 GB |
| Prometheus TSDB (30d retention) | 40 GB |
| Logs + tmp | 40 GB |
| Reserve | ~60 GB |

Filesystem ext4 hoặc xfs. Khuyến nghị separate mount cho `postgresql` + `minio` khi provider hỗ trợ multi-volume.

### Scale headroom
- 8 vCPU + 32GB đủ cho ~50 concurrent user, ~5 embed job/s peak.
- Ngưỡng cân nhắc scale-up hoặc thêm GPU: embedding queue lag >100 sustained, CPU steady >70%, PG connection saturate.
- HA (replica PG + LB) chưa cần v1; chỉ khi >200 concurrent user hoặc SLA > 99.9%.

## Key Insights
- **Backup không tự động = mất data.** Postgres WAL archive + MinIO versioning + rotation là non-negotiable.
- **Monitoring first** — pilot cần visibility ngay ngày 1 để phát hiện regression.
- **Load test trước rollout** — validate P95 target thực tế với 20-50 concurrent user.

## Requirements

### Functional
- Portal admin dashboard: users, roles, dept stats, skill loads/day, artifact submits/day, session wrapup ratio.
- Audit event viewer: filter actor/action/resource/date-range, export CSV.
- Backup: Postgres pgBackRest hoặc pg_basebackup + WAL archive to MinIO daily; MinIO bucket versioning + lifecycle.
- Restore runbook + drill test.
- Prometheus metrics + Grafana dashboard.
- Alerting (Alertmanager → email/Slack): backup fail, uptime, high error rate, embedding queue lag.
- Load test suite (k6) simulating 50 concurrent users doing search + submit.

### Non-Functional
- Backup RPO ≤ 24h, RTO ≤ 4h.
- Metrics retention ≥ 30 ngày.
- Uptime ≥ 99.5% trong 30 ngày pilot.

### Storage & Backup Layout (chốt validation)
- **MinIO primary trên VPS production** — attachments + PG WAL archive.
- **MinIO backup mirror external S3** — cron `mc mirror` daily sang NAS/S3 công ty. Bảo vệ khi VPS chết toàn phần.
- **Staging VPS song song** (4vCPU/8GB/200GB Ubuntu 24.04) — restore drill + migration test + load test không đụng prod.

### Migration Safety (H5 mitigation)
- Mỗi TypeORM migration có `.down()` implementation bắt buộc.
- CI test round-trip: migrate up → down → up trên schema fresh.
- Runbook migration rollback + preservation test.

### Ubuntu 24.04 Risk (H1 mitigation)
- Staging VPS làm canary — deploy Ubuntu 24.04 trước prod 1 tuần.
- Nếu image ecosystem có issue lớn → fallback runbook downgrade 22.04 LTS.
- Test full compose stack lên VM local Ubuntu 24.04 trước provision VPS.

## Architecture

```
[Backend] ──/metrics──► [Prometheus] ──► [Grafana]
                           │
                           ▼
                     [Alertmanager] ──► email/Slack

[Postgres] ──WAL──► [pgBackRest] ──► MinIO backup bucket (versioned)
                                            │
[MinIO attachments] ── versioning bật ──────┘

[k6 scripts] ──► staging → measure P50/P95/P99
```

## Related Code Files (to create)

### backend/
```
src/observability/
├── observability.module.ts
├── prometheus.controller.ts                   # /metrics
├── metrics.service.ts                         # custom counters/histograms
└── health.controller.ts                       # /health /ready

src/admin/
├── admin.module.ts
├── admin-stats.service.ts
├── admin-stats.controller.ts
├── audit-viewer.controller.ts
└── dto/audit-query.dto.ts
```

### portal/
```
app/admin/
├── dashboard/page.tsx                         # stats overview
├── users/page.tsx                             # user + role management
├── audit/page.tsx                             # audit viewer with filters
└── skills-stats/page.tsx
```

### ops/
```
ops/
├── backup/
│   ├── pgbackrest.conf
│   ├── backup-cron.sh                         # daily full + hourly WAL
│   ├── restore-runbook.md
│   └── minio-lifecycle.json
├── monitoring/
│   ├── docker-compose.monitoring.yml          # prometheus + grafana + alertmanager
│   ├── prometheus.yml
│   ├── alert-rules.yml
│   └── grafana/dashboards/onemcp.json
├── load-test/
│   ├── search-load.js                         # k6
│   ├── submit-load.js                         # k6
│   └── mixed-workload.js
└── security/
    ├── security-review-checklist.md
    └── penetration-test-notes.md
```

### docs/
```
docs/
├── deployment-guide.md
├── operations-runbook.md
├── backup-restore-runbook.md
└── security-audit-report.md
```

## Implementation Steps

1. **Prometheus module** — expose /metrics: http_requests_total, request_duration_seconds histogram, artifact_submits_total, skill_loads_total, embedding_queue_depth, embedding_duration_seconds.
2. **Health/ready endpoints** — check DB, Redis, MinIO connectivity.
3. **Admin stats service** — aggregate queries: DAU, artifacts/day/type/dept, top skills, session-wrapup ratio.
4. **Audit viewer** — paginated query với filter + CSV export.
5. **Portal dashboard** — charts (Recharts), auto-refresh 30s.
6. **Portal admin pages** — users list, role assign, audit viewer, skills stats.
7. **Backup setup** — pgBackRest config, cron container hoặc host cron, target MinIO backup bucket separate credentials.
8. **MinIO lifecycle** — expire old versions >90 days cho attachments, immutable cho backup bucket.
9. **Monitoring stack** — separate docker-compose.monitoring.yml, prometheus scrape backend + node_exporter + postgres_exporter + redis_exporter.
10. **Alert rules** — backup fail, service down >2 phút, http_5xx_rate > 1%, embedding_queue_depth > 100 sustained 10 phút.
11. **k6 load test** — scenarios: 50 VU search, 20 VU submit, ramp-up. Report P50/P95/P99.
12. **Security review** — OWASP top 10 checklist, dependency scan (npm audit + snyk), JWT/cookie config audit, secret scan CI.
13. **Restore drill** — staging: destroy DB → restore từ backup → validate. Ghi runbook thời gian thực tế.
14. **Docs** — deployment-guide, ops runbook, backup/restore runbook, security report.

## Todo
- [ ] Prometheus metrics module
- [ ] /health /ready endpoints
- [ ] Admin stats service + controller
- [ ] Audit viewer controller + CSV export
- [ ] Portal admin dashboard
- [ ] Portal users management
- [ ] Portal audit viewer
- [ ] Portal skills stats
- [ ] pgBackRest config + cron
- [ ] MinIO lifecycle policies
- [ ] Backup bucket separate credentials
- [ ] Restore drill + runbook
- [ ] Monitoring docker-compose
- [ ] Grafana dashboard JSON
- [ ] Alertmanager routes
- [ ] k6 load test scripts
- [ ] Load test report
- [ ] Security review checklist run
- [ ] npm audit + Snyk scan
- [ ] Docs: deployment/ops/backup/security

## Success Criteria
- Prometheus scrape backend + Grafana dashboard hiển thị metrics.
- Alert fire khi service dừng >2 phút (test).
- Backup drill restore thành công < 4h.
- Load test P95 đạt target (search <800ms, submit <1s).
- 0 critical / 0 high finding trong security review.
- Runbook đủ chi tiết cho on-call không quen dự án làm theo.

## Risk Assessment
- **Backup fail silently** → alert on backup timestamp lag > 26h.
- **Restore untested** → mandatory drill trước rollout, quarterly repeat.
- **Load test khác thực tế** → dùng anonymized prod-like data volume; iterate sau pilot 30 ngày.
- **Alert fatigue** → tune thresholds sau tuần 1 pilot.

## Security Considerations
- Rotate secrets sau security review (INET client secret, GitLab OAuth, JWT signing, MinIO creds).
- Container image scan (trivy) trong CI.
- Nginx: HSTS, secure headers, rate limit MCP endpoint per PAT.
- Backup bucket encryption at rest (SSE-S3).
- Audit chính viewer cũng bị audit (không invisible admin).

## Next Steps
- Rollout Kỹ thuật pilot 30 ngày → collect feedback.
- Retrospective + plan v2 (mở rộng dept, GPU embedding, hard session hooks, sandbox skill execution).

## Unresolved (v1 exit questions)
- Ai on-call cho pilot?
- Escalation path khi service down ngoài giờ?
- SLA cam kết cho maintainer approve MR/artifact (ví dụ 24h)?
