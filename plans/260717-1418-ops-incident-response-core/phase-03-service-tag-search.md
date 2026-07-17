---
phase: 03
name: Service tag boost + filter search
status: completed
effort: 0.5 day
priority: P1
depends: [phase-02]
---

# Phase 03 — Service tag boost + filter search

## Context

Ops query `"postgres oom"` — hiện search rank thuần FTS. Cần detect service keyword → boost artifacts có tag/service match. Runbook type có field `service` → boost strong nhất.

## Requirements

**Functional:**
- REST `GET /api/search?q=...&service=postgres` — nếu client biết service, hint direct
- Nếu client không hint: server auto-detect `KNOWN_SERVICES` list trong query text
- Ranking adjust:
  - Base: `ts_rank_cd × 2 + similarity(title)`
  - Bonus +2.0 nếu artifact type=runbook AND service field match
  - Bonus +1.0 nếu artifact tag chứa service
  - Bonus +0.5 nếu skill tag chứa service
- MCP `search` tool thêm optional param `service`
- KNOWN_SERVICES config env `ONEMCP_KNOWN_SERVICES` (comma-sep, default: `postgres,redis,nginx,minio,backend,portal,gitlab`)

**Non-functional:**
- Không break existing search behavior khi không có service hint
- Detection case-insensitive
- Không hard-code trong code — env driven cho ops tự thêm service mới

## Related files

**Modify:**
- `backend/src/search/search.service.ts` — thêm param `service`, extend SQL rank formula
- `backend/src/search/search.controller.ts` — parse `?service=` param
- `backend/src/mcp/mcp-tools.service.ts` — thêm `service` optional trong tool input schema + pass down
- `.env.example` — thêm `ONEMCP_KNOWN_SERVICES`
- `docs/system-architecture.md` — cập nhật search section

## SQL rank tweak (concept)

```sql
SELECT
  ...,
  (ts_rank_cd(body_search, query) * 2
   + similarity(title, :q)
   + CASE WHEN type = 'runbook' AND service = :service THEN 2.0 ELSE 0 END
   + CASE WHEN tags @> ARRAY[:service] THEN 1.0 ELSE 0 END
  ) AS rank
FROM artifacts_search
WHERE ...
ORDER BY rank DESC
LIMIT :limit
```

Skills subquery tương tự với bonus 0.5.

## Implementation steps

1. Parse `KNOWN_SERVICES` từ env vào `SearchService` constructor
2. Auto-detect: `if (!service) service = KNOWN_SERVICES.find(s => q.toLowerCase().includes(s))`
3. Extend SQL raw query với CASE expressions
4. Update controller + MCP tool schema
5. Test 3 cases:
   - Query `"postgres oom"` không hint → auto-detect `postgres` → runbook postgres-* rank top
   - Query `"redis eviction"` + explicit `service=redis` → runbook redis rank top
   - Query `"generic error"` → no boost, ranking base
6. Verify metrics/logs không noise

## Todo

- [ ] Env var + parse
- [ ] Auto-detect logic
- [ ] SQL rank formula extend (artifacts + skills subquery)
- [ ] Controller param
- [ ] MCP tool schema `service` optional
- [ ] `.env.example` doc
- [ ] Curl test 3 cases
- [ ] Verify existing search regression nào

## Success criteria

- Query `postgres oom` return runbook postgres-* first
- Query không có known service → ranking không đổi
- MCP `search` tool có param `service`, agent có thể pass explicit

## Risks

| Risk | Mitigation |
|---|---|
| False positive (service word xuất hiện tình cờ) | Boost thay filter — không hide result, chỉ re-rank |
| Query rẽ nhánh nếu keyword đa service | Chỉ detect 1 service đầu tiên match (KISS) |
| Ranking tune tay | Ghi log rank breakdown mode debug — env `SEARCH_DEBUG=1` để review nếu cần tune |

## Red Team Redlines (2026-07-17)

- **[RT-3, Critical] Verify `service` column exists (see Phase 02 redline).** SQL snippet's `service = :service` will 500 without the schema change. Bind as `$` parameter (never string-concat), and validate the explicit `?service=` query param against `KNOWN_SERVICES` allowlist (currently the plan only allowlists auto-detected values; the explicit param is unconstrained).
- **[RT-10, High] Fix auto-detect: substring `.includes()` + case-sensitive tag `@>` will silently mis-rank.**
  - Use word-boundary regex per service: `new RegExp(\`\\b${service}\\b\`, 'i')` — prevents `redis` matching `"redistribute"` and `gitlab` matching `"gitlab-runner"`.
  - Normalize tags to lowercase on write (add backfill migration for existing artifacts), OR change tag match to `EXISTS (SELECT 1 FROM unnest(a.tags) t WHERE lower(t) = $service)`. Current `tags @> ARRAY[:service]` fails on any capitalized tag (`Postgres`, `PostgreSQL`).
  - If multiple services word-match, don't boost (log ambiguity in `SEARCH_DEBUG=1`).
  - Add regression tests: `"redistribute traffic"` → no redis boost; query with `Postgres` tag → boost fires.
