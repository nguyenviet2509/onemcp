# Debug Guide — Production Incident Workflow

## Step 1: Stabilize before diagnose

- Nếu revenue-critical → rollback ngay, sau đó diagnose ở staging.
- Nếu isolated → tăng monitoring, keep serving, không rollback vội.

## Step 2: Gather context

1. **Logs**: kibana search `request_id:<id>` — correlate xuyên services.
2. **Metrics**: check Grafana dashboard `api-latency` — spike?
3. **Recent changes**: `git log --since="6 hours ago" main` — deploy nào có suspect?
4. **Search OneMCP KB**: call MCP `search` với error message. Nếu ai đó đã trace bug tương tự → skip Step 3-4.

## Step 3: Reproduce

- Local: `docker compose up -d` + replay request từ Postman collection.
- Nếu prod-only → binary search: check request body diff giữa working + broken.

## Step 4: Isolate

- Xác định layer: nginx / backend / db / external API?
- Add temporary log statement nếu cần → deploy staging → retry.

## Step 5: Fix + verify

- Fix trong branch → PR → merge sau code review.
- Deploy staging → run test suite + e2e.
- Deploy prod → monitor 30 phút.

## Step 6: Wrap up (MANDATORY)

- Call MCP `submit_artifact` type=`report` với sections đầy đủ (root_cause + remediation).
- Nếu là recurring pattern → thêm entry type=`kb` để trace-bug reuse.

## Common pitfalls

- Fix triệu chứng thay root cause → recurring incident.
- Deploy prod trực tiếp không staging → mở rộng blast radius.
- Không submit KB → dev khác lặp lại debug cycle.
