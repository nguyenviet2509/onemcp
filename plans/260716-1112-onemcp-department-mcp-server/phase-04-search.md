# Phase 04 — Search (FTS + Semantic)

**Priority:** Medium-High
**Status:** pending
**Est.:** 1.5 tuần
**Depends on:** P3 (artifacts CRUD)

## Overview
Full-text search VN+EN qua Postgres `tsvector` + unaccent + pg_trgm; semantic search qua pgvector với embedding `multilingual-e5-small` (384-dim) chạy ONNX Runtime trên CPU. Hybrid search API kết hợp cả hai.

## Key Insights
- **1 DB fits all** — Postgres FTS + pgvector đủ cho scale pilot, tránh OpenSearch/Meilisearch phức tạp.
- **CPU embedding OK** — volume nhỏ, embed background async, không chặn user.
- **Migration-safe dim** — bắt đầu 384-dim; nếu đổi sang bge-m3 (1024-dim) sau, thêm cột `embedding_v2`, giữ cả hai trong transition.

## Requirements

### Functional
- FTS index trên `artifact_versions.body + title + tags` (weighted).
- unaccent để VN tìm không dấu match có dấu.
- pg_trgm fallback cho fuzzy match token.
- Embedding worker BullMQ: consume pending artifact versions → embed → update `embedding`.
- Query-time embed cho search query (cached in Redis 5 phút).
- Hybrid ranking: `score = 0.6 * fts_rank + 0.4 * (1 - cosine_distance)`.
- MCP tool `search_artifacts(query, type?, dept?, limit=10)`.
- REST endpoint tương ứng cho portal.

### Non-Functional
- P95 FTS < 800ms, semantic < 1.2s (bao gồm query embed).
- Embed job P95 < 5s cho artifact 5KB.
- Query cache hit rate > 30% (phân tích P6).

## Architecture

```
[submit_artifact P3] ──enqueue──► [embedding-queue]
                                        │
                              [EmbeddingWorker]
                                        │
                     load ONNX model ── e5-small (in-memory)
                                        │
                     embed(title + summary + body chunks[:500 tokens])
                                        │
                     UPDATE artifact_versions SET embedding=$1

[Search request] ──► [SearchService]
                          │
                ┌─────────┴─────────┐
                │                   │
         [FTS query]         [Embed query text]
         tsvector @@          (Redis cache)
         plainto_tsquery              │
                │                     ▼
                │             [Vector search]
                │             ORDER BY cosine_distance
                │                     │
                └──────► [Hybrid ranker] ──► top N
```

## Related Code Files (to create)

### backend/
```
src/search/
├── search.module.ts
├── search.service.ts
├── search.controller.ts
├── ranking.ts                                  # hybrid score formula
├── query-cache.service.ts                      # Redis
└── dto/search-artifacts.dto.ts

src/embedding/
├── embedding.module.ts
├── embedding.service.ts                        # ONNX Runtime wrapper
├── tokenizer.ts                                # transformers.js or manual
├── chunker.ts                                  # 500-token windows
├── workers/artifact-embedding.worker.ts        # BullMQ consumer
└── model-loader.ts                             # lazy load, singleton

src/mcp/tools/search-artifacts.tool.ts

src/db/migrations/1720300000000-search-indexes.ts
```

### portal/
```
app/search/page.tsx                             # unified search UI
components/search-bar.tsx                       # global header
lib/api/search.ts
```

### ops/
```
ops/models/
└── multilingual-e5-small/                      # ONNX + tokenizer files
    ├── model.onnx
    ├── tokenizer.json
    └── config.json
```

## Implementation Steps

1. **DB migration** — thêm cột `tsv tsvector GENERATED ALWAYS AS (...) STORED`, `embedding vector(384)`, GIN index trên tsv, ivfflat index trên embedding (lists=100), pg_trgm GIN cho title.
   - **FTS weight assignment (crucial cho KB bug-trace recall):**
     - Weight **A** (highest): `title` + `structured->>'symptoms'` (concat) + `tags`. Đây là fields dev sẽ paste/search khi hit lỗi lại.
     - Weight **B**: `structured->>'root_cause'` + `structured->>'solution'` + `summary`.
     - Weight **C**: `body`.
     - Weight **D**: `references[]`.
   - Generated column dùng `setweight(to_tsvector('simple', unaccent(...)), 'A') || setweight(..., 'B') || ...`.
   - Type-specific: report/research dùng cùng schema fields (fallback empty string nếu field không có).
2. **Download model** — script `scripts/fetch-embedding-model.sh` tải e5-small ONNX từ HuggingFace, mount vào backend container.
3. **Embedding service** — onnxruntime-node, load model 1 lần, embed(texts[]) → number[][]. Tokenizer qua `@xenova/transformers` hoặc trực tiếp tokenizer.json.
4. **Chunker** — nếu body > 500 tokens, chia chunk overlap 50, embed từng chunk → average pool. Đơn giản v1.
5. **Embedding worker** — BullMQ, concurrency 2, job payload `{ artifact_version_id }`. Retry 3 lần với backoff.
6. **Hook submit P3** — sau khi tạo artifact_version → enqueue embedding job.
7. **Search service FTS** — build `plainto_tsquery('simple', unaccent(query))`, weighted `A` title + `B` tags + `C` body, ORDER BY ts_rank_cd.
8. **Search service semantic** — embed query (cache Redis 5 phút key = sha1(query)), `ORDER BY embedding <=> $1 LIMIT k`.
9. **Hybrid ranker** — merge 2 result sets, normalize scores 0-1, weighted sum, dedupe by artifact_id.
10. **MCP + REST** — expose `search_artifacts`. RBAC: chỉ trả artifacts user được xem (dept + role).
11. **Portal search page** — global search bar, filter type/tag/dept, hiển thị snippet + score.
12. **Backfill script** — embed tất cả published artifacts hiện có (dùng khi rollout hoặc đổi model).
13. **E2E** — submit artifact → wait embedding done → search VN không dấu → assert hit.

## Todo
- [ ] Search-indexes migration (tsv + embedding + indexes)
- [ ] Model fetch script
- [ ] ONNX embedding service
- [ ] Tokenizer setup
- [ ] Chunker + average pool
- [ ] BullMQ embedding worker
- [ ] Hook submit → enqueue
- [ ] FTS query builder + unaccent
- [ ] Semantic query + Redis cache
- [ ] Hybrid ranker
- [ ] Search REST + MCP tool
- [ ] Portal search page + snippet highlight
- [ ] Backfill CLI script
- [ ] E2E VN không dấu test
- [ ] Load test: 100 concurrent search
- [ ] Compile check

## Success Criteria
- Query "quy trình deploy" match được artifact chứa "Quy trình Deploy".
- Query VN không dấu "quy trinh" match có dấu.
- Semantic search cho query paraphrase (VD "cách triển khai" match "quy trình deploy").
- **Bug-trace scenario:** paste error message như `ECONNRESET when calling billing api` → KB có field `symptoms=["ECONNRESET"]` xuất hiện top 3 result nhờ weight A.
- P95 latency đạt target.
- Embedding worker xử lý hết queue trong <10s cho batch 20 artifacts.

## Risk Assessment
- **ONNX Runtime memory** → model ~470MB RAM, backend container reserve 2GB.
- **ivfflat recall thấp khi ít data (H2 mitigation)** → v1 dùng exact search (`<->` không index) đến khi >1000 rows. Sau đó dùng **HNSW index** (pgvector 0.5+) — recall tốt hơn ivfflat ở low data volume. Update decision khi migration.
- **ONNX inference chậm không lường trước (H3):** benchmark thực tế trên VPS staging trước khi commit config. Nếu >1s/doc → thay bằng `@xenova/transformers` quantized hoặc `fastembed`. Nếu vẫn quá chậm → GPU sớm.
- **Redis crash mất queue (H4):** enable AOF persistence (`appendonly yes`, `appendfsync everysec`). Queue job unique key theo `artifact_version_id` → idempotent worker.
- **Query embed latency** → Redis cache + warm up common queries.
- **Model drift khi upgrade** → chiến lược dual-column migration đã plan.

## Security Considerations
- Search kết quả filter RBAC ở DB query level (không filter ở app layer sau khi lấy).
- Query cache key sha1 → không leak content queries khác user.
- Log search queries cho audit + analytics (respect PII).

## Next Steps
- P5 hook template validate vào submit trước khi enqueue embed.
- P6 dashboard search analytics.
