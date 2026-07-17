# Monitoring — Prometheus + Grafana

## /metrics endpoint

Backend expose Prometheus format tại `GET /metrics` (bypass CIDR guard, không auth).

**Restrict prod**: nginx location `/metrics` allow chỉ Prometheus scraper IP.

### Metrics available

| Metric | Type | Labels | Purpose |
|---|---|---|---|
| `onemcp_http_requests_total` | counter | method, route, status | Request count |
| `onemcp_http_request_duration_seconds` | histogram | method, route, status | Latency SLI |
| `onemcp_artifact_submits_total` | counter | type, result | Submit rate (adoption metric) |
| `onemcp_skill_loads_total` | counter | skill | MCP skill usage |
| `onemcp_mcp_tool_calls_total` | counter | tool, result | MCP tool usage |
| `onemcp_process_*` | default | — | Node.js process metrics |

## Prometheus config

`prometheus.yml` sample:
```yaml
scrape_configs:
  - job_name: onemcp-backend
    metrics_path: /metrics
    scheme: https
    tls_config:
      insecure_skip_verify: true  # self-signed lab
    static_configs:
      - targets: ['onemcp.local']
```

## Grafana dashboards (recommend)

### Panel: Request latency p50/p95/p99
```promql
histogram_quantile(0.95,
  rate(onemcp_http_request_duration_seconds_bucket[5m])
)
```

### Panel: Error rate
```promql
sum(rate(onemcp_http_requests_total{status=~"5.."}[5m]))
  / sum(rate(onemcp_http_requests_total[5m]))
```

### Panel: Artifact submits per day
```promql
sum(increase(onemcp_artifact_submits_total{result="ok"}[24h])) by (type)
```

### Panel: KB reuse (skill load hourly)
```promql
sum(rate(onemcp_skill_loads_total[1h])) by (skill)
```

### Adoption metric (weekly)
```promql
count(count by (route)(rate(onemcp_http_requests_total{route="/api/artifacts"}[7d]) > 0))
```

## Alerting rules (recommend)

```yaml
groups:
  - name: onemcp
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(onemcp_http_requests_total{status=~"5.."}[5m]))
            / sum(rate(onemcp_http_requests_total[5m])) > 0.05
        for: 10m
        annotations:
          summary: "OneMCP error rate > 5%"

      - alert: BackendDown
        expr: up{job="onemcp-backend"} == 0
        for: 2m

      - alert: LowKbSubmitRate
        expr: sum(rate(onemcp_artifact_submits_total{type="kb",result="ok"}[24h])) < 0.02
        for: 3d
        annotations:
          summary: "KB submit dropped — check adoption"
```

## Verify /metrics

```bash
# Từ VPS host (bypass CIDR — metrics is public path)
curl -sk https://onemcp.local/metrics | head -30

# Từ backend container (internal)
docker compose exec -T backend wget -qO- http://127.0.0.1:3000/metrics | head -30
```

Kỳ vọng: prometheus text format với `# HELP` + `# TYPE` headers + counters.
