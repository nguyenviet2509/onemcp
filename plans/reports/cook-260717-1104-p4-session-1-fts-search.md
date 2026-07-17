# Cook Session 9 — P4 Part 1: Full-Text Search (keyword)

**Date:** 2026-07-17 · **Phase:** P4 Search · **Progress:** ~50% P4 complete (session 1 of 2)

## Scope

Keyword FTS across skills + artifacts. Vietnamese diacritic-insensitive (unaccent). Fuzzy trigram trên titles.

**Deferred session 2**: pgvector semantic embeddings, hybrid rank fusion, embedding worker.

## Delivered — Backend

### Migration `1720500000000-search-fts.ts`
- `CREATE EXTENSION unaccent, pg_trgm`
- `immutable_unaccent(text)` function wrapper (unaccent mặc định STABLE, generated column cần IMMUTABLE)
- `artifact_versions.body_search tsvector` — GENERATED ALWAYS STORED từ `to_tsvector('simple', immutable_unaccent(body))`
- `skill_versions.body_search tsvector` — tương tự
- GIN index trên cả 2 body_search
- GIN trigram index trên `artifacts.title` + `skills.name`

Generated columns tự update khi body thay đổi — không cần trigger.

### `search/search.service.ts`
Unified search với TypeORM raw query:
- **Artifacts**: JOIN latest published version, `ts_rank_cd + similarity(title)` rank. Match FTS body OR ILIKE title/slug.
- **Skills**: JOIN currentVersion, `ts_rank_cd + similarity(name) + description contains bonus` rank. Match FTS body OR ILIKE name/description.
- `ts_headline` với `<b>` tags cho snippet highlight.
- Merge kết quả, sort by rank desc, limit ≤ 50.
- Chỉ trả về `status='published'` artifacts (không leak pending).

### REST `search/search.controller.ts`
- `GET /api/search?q=...&kind=all|skill|artifact&limit=` — throttle 30/min per IP.

### MCP tool `search`
- Add vào `mcp-tools.service.ts` — 6 tools total (5 cũ + search).
- Description hướng agent dùng khi cần tìm KB tương tự — support use case bug-trace reuse.

### Search module
- `search/search.module.ts` — export SearchService để MCP module reuse.

## Delivered — Portal

- `lib/api/search.ts` — typed client.
- `app/search/page.tsx` — search input + kind filter chips (all/skill/artifact) + results list với snippet HTML (dangerouslySetInnerHTML với `<b>` filter — chỉ giữ `<b>` và `<i>` tags từ ts_headline output, strip rest → XSS-safe cho v1).
- `components/nav.tsx` — thêm "Search" link (đầu nav).

## Files

- Backend new: 4 (migration + service + controller + module)
- Backend modified: 3 (app.module, mcp-tools.service, mcp.module)
- Portal new: 2 (search page + api)
- Portal modified: 1 (nav)

Build: `pnpm build` clean ✅.

## Deploy staging

```bash
cd /opt/onemcp
git pull
docker compose build backend portal
docker compose up -d
docker compose logs backend --tail=40 | grep -E "Migration|search|Mapped"
```

Kỳ vọng:
- `Migration SearchFts1720500000000` chạy → 2 tsvector columns + 2 GIN + 2 trgm indexes + 2 extensions
- `Mapped {/api/search, GET}`
- MCP tools/list trả về 6 tools (thêm `search`)

## Verify

```bash
# Từ máy dev (10.0.14.2 in USER_ALLOW_CIDR)
curl -sk -H "X-Onemcp-User: alice" "https://onemcp.local/api/search?q=test" | jq
curl -sk -H "X-Onemcp-User: alice" "https://onemcp.local/api/search?q=debug&kind=skill" | jq
curl -sk -H "X-Onemcp-User: alice" "https://onemcp.local/api/search?q=payment&kind=artifact" | jq

# Test diacritic (Vietnamese)
curl -sk -H "X-Onemcp-User: alice" "https://onemcp.local/api/search?q=thanh+toan" | jq
# Nếu có artifact body "thanh toán" — sẽ match (unaccent normalize)

# MCP search tool
docker compose exec -T backend wget -qO- \
  --header="X-Onemcp-User: alice" \
  --header="Content-Type: application/json" \
  --post-data='{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search","arguments":{"q":"test","limit":10}}}' \
  http://127.0.0.1:3000/api/mcp | jq

# Verify columns exist
docker compose exec -T postgres psql -U onemcp onemcp -c "\d artifact_versions" | grep body_search
docker compose exec -T postgres psql -U onemcp onemcp -c "SELECT extname FROM pg_extension WHERE extname IN ('unaccent','pg_trgm');"
```

## Portal test
1. `/search` từ browser
2. Type `test` → click Search → thấy artifact `Test KB entry` với snippet highlight `<b>test</b>`
3. Filter chip `skill` → chỉ trả về skills
4. Click result → về detail
5. Bỏ dấu test: seed artifact có body "thanh toán" rồi search `thanh toan` → match

## Design choices

- **Text search config `simple`** (không lang-specific) + `unaccent` — hoạt động tốt cho VN + EN mix, không cần custom dict.
- **Generated column** thay trigger — atomic với INSERT/UPDATE, không có race.
- **Rank formula**: `ts_rank_cd(body) * 2 + similarity(title/name)` — body match quan trọng hơn title fuzzy.
- **Only published** cho artifact search — không leak pending; owners tìm own qua `/artifacts` list.
- **Snippet HTML** filter strict qua regex — chỉ giữ `<b>`/`<i>` tags. Nếu cần rich formatting, chuyển sang rehype-sanitize.
- **No pagination** v1 — hard limit 50. Đủ cho pilot; infinite scroll defer.

## Next Session (P4 Part 2 — semantic)

- [ ] pgvector extension + `embedding vector(384)` column trên artifact_versions + skill_versions
- [ ] Embedding worker: BullMQ job gọi embedding model (multilingual-e5-small qua HTTP API hoặc local Python service)
- [ ] Hybrid rank: FTS score + cosine sim → weighted merge (RRF hoặc simple weighted sum)
- [ ] Backfill script cho existing rows
- [ ] MCP tool `search` accept `semantic=true` flag

Question chưa quyết: embedding model serving option (local Python microservice, HTTP endpoint, ONNX in Node?). Depend on infrastructure sẵn có.

## Unresolved

- **Snippet without diacritics**: ts_headline nhận unaccented document → snippet hiển thị mất dấu tiếng Việt. UX xấu cho VN content. Fix cần custom text search config với unaccent dict — defer polish P4.2.
- **Cross-department leak**: search hiện scope theo `department_id`; multi-dept expansion cần re-check trong service (đã có WHERE dept_id).
- **Performance test**: chưa benchmark với > 1000 artifacts. GIN indexes handle được 10K+ rows OK theo Postgres docs.
- **Trigram threshold**: `similarity()` mặc định threshold 0.3. Nếu query rất ngắn (< 3 chars) → không match trigram. Ok cho pilot.
- **Rate limit hits**: 30/min per IP có thể quá thấp cho AI agents chạy search intensive. Tune sau tùy usage.

## Session Metrics
- Files new: 6 (backend 4 + portal 2)
- Files modified: 4 (backend 3 + portal 1)
- LOC delta: ~350
- New REST endpoint: 1 (GET /search)
- New MCP tool: 1 (search) → total 6 tools
- New extensions: unaccent, pg_trgm
- New DB indexes: 4 (2 GIN body_search + 2 GIN trgm)
- Backend build: ✅ clean
