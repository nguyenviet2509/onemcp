# mock-osh-admin

**DEV-ONLY** — Mock HTTP server simulating the `osh_admin` API for OneMCP tool-bridge smoke testing.
Do NOT ship this in `docker-compose.yml` (prod).

## Purpose

Validates the full OneMCP → upstream bridge workflow without depending on the real `osh_admin` service:
- Bearer token service-to-service auth check
- Header forwarding (`X-Onemcp-User-Sub`, `X-Onemcp-Correlation-Id`)
- Fake RBAC gate (per-user permission map)
- Failure scenario injection (slow / 5xx / large / malformed)

## Quick start (local)

```bash
cd mock-osh-admin
npm install
node server.js
# → http://localhost:8080/health
```

Environment:
- `PORT` — default `8080`
- `MOCK_BEARER` — default `dev-fixed-token`

## Via docker-compose.dev.yml

```bash
docker compose -f docker-compose.dev.yml up mock-osh-admin
curl http://localhost:8080/health
```

## Test users (fake RBAC gate)

| `X-Onemcp-User-Sub` | Permissions |
|---|---|
| `test-user-x` | all 3 tools |
| `test-user-y` | none (all 403) |
| `test-user-partial` | `query_access_log` only |

Bypass gate: `X-Force-Rbac-Bypass: true`

## Endpoints

| Method | Path | Body/Query |
|---|---|---|
| `GET` | `/health` | — |
| `POST` | `/waf/rules` | `{domain, ip?, rules?}` |
| `POST` | `/rate-limits` | `{domain, limit_rps}` |
| `GET` | `/access-logs` | `?domain=X&since=ISO&limit=N` |

## Scenario injection (`?scenario=`)

| Value | Behavior | Tests |
|---|---|---|
| `slow` | 15s delay | OneMCP 10s abort |
| `5xx` | 502 response | retry logic |
| `large` | 2MB body | response cap truncation |
| `malformed` | invalid JSON | parse error handling |

Example: `curl "http://localhost:8080/access-logs?domain=foo.com&scenario=slow" -H "Authorization: Bearer dev-fixed-token" -H "X-Onemcp-User-Sub: test-user-x"`

## Stdout log format

```json
{"ts":"2026-09-17T10:00:00.000Z","method":"POST","path":"/waf/rules","user_sub":"test-user-x","correlation_id":"abc-123","outcome":"allow"}
```

## Prod swap procedure

When the real `osh_admin` service is ready:

1. In OneMCP Admin UI → Tool Bridges → upstream `osh_admin`
2. Update `base_url` from `http://mock-osh-admin:8080` → real prod URL
3. Rotate `bearer` to real token (encrypted by OneMCP automatically)
4. Run test-call dry-run for each bridge → verify 200
5. Remove or comment out `mock-osh-admin` service from `docker-compose.dev.yml`

See `docs/onemcp-tool-bridge-runbook.md` → "Prod swap procedure" for full steps.
