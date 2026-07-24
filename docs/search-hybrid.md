# Hybrid Search — Architecture & Usage

Phase 2C feature. Combines FTS (PostgreSQL full-text) + vector (pgvector cosine) with
Reciprocal Rank Fusion to return the best results from both signals.

---

## Overview

```
Query
  │
  ├─── FTS branch ──────────────────────── plainto_tsquery('simple', unaccent(q))
  │    body_search @@ tsquery → ts_rank_cd                          │
  │                                                                  ▼
  └─── Vector branch ─── embed(q) via TEI ──── cosine distance (pgvector <=>)
                                                                     │
                                               RRF merge (k=60) ◄───┘
                                                      │
                                               hydrate metadata
                                                      │
                                              HybridSearchHit[]
```

Both branches run in parallel (sequential await in same request, not concurrent futures).
Vector branch is skipped silently when TEI is unreachable — FTS results are returned as-is.

---

## Modes

| Mode | FTS | Vector | Notes |
|---|---|---|---|
| `hybrid` (default) | ✅ | ✅ | RRF merges both lists |
| `fts` | ✅ | ❌ | Keyword-only; fastest |
| `semantic` | ❌ | ✅ | Vector-only; no ts_headline snippet |

### Kill switch

Set `SEARCH_MODE=fts-only` in backend env to disable vector branch globally (e.g. TEI not
deployed, cold start, resource constraints). Override is logged at startup as WARN.

---

## Embedding provider

- **Model:** `intfloat/multilingual-e5-small` served via HuggingFace TEI
- **Dimensions:** 384
- **Input cap:** 2000 characters (truncated before embed call)
- **Provider class:** `E5SmallLocalProvider` (`embeddings/providers/e5-small-local.provider.ts`)
- **Endpoint:** `TEI_BASE_URL` env (e.g. `http://tei:80`) — `POST /embed`
- **Batch:** single-string embed per query (no batching needed for search path)

---

## RRF formula

```
score(d) = Σ  1 / (k + rank_i(d))
           i

k = 60  (standard Cormack & Clarke constant)
```

Each result list contributes a `1/(60 + rank)` term. Documents appearing in both lists
accumulate two contributions and naturally surface at the top.

Implementation: `search/rrf-merge.ts` — pure function, no DB dependency.

---

## Vector index

```sql
-- ivfflat index on embeddings.vector column (dim=384)
CREATE INDEX embeddings_vector_ivfflat_idx
  ON embeddings USING ivfflat (vector vector_cosine_ops)
  WITH (lists = 100);
```

`lists=100` is appropriate for up to ~1M rows. Recall improves after `ANALYZE embeddings`
(cold-start limitation — index statistics need at least one ANALYZE run after bulk insert).

---

## Query API

### POST /api/search/hybrid

```bash
# Hybrid (default) — FTS + vector + RRF
curl -X POST https://onemcp.example/api/search/hybrid \
  -H 'Content-Type: application/json' \
  -H 'X-Onemcp-User: alice' \
  -d '{"query": "postgres oom killed", "limit": 10}'

# FTS-only
curl ... -d '{"query": "redis eviction", "mode": "fts"}'

# Semantic (vector-only)
curl ... -d '{"query": "database connection exhausted", "mode": "semantic"}'

# With filters
curl ... -d '{
  "query": "incident response",
  "mode": "hybrid",
  "spaceId": "uuid-of-space",
  "templateKey": "postmortem",
  "tags": ["postgres", "sev1"],
  "limit": 20
}'
```

### Response shape

```json
[
  {
    "artifactId": "123",
    "versionId": "456",
    "title": "Postgres OOM Runbook",
    "slug": "postgres-oom-runbook",
    "templateKey": "runbook",
    "spaceId": "uuid",
    "tags": ["postgres", "oom"],
    "snippet": "...highlighted excerpt...",
    "source": "hybrid",
    "ftsRank": 0.412,
    "vectorRank": 3,
    "rrfScore": 0.0159
  }
]
```

---

## Saved searches

Persist a query + filter combo for quick re-execution.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/search/saved` | Save current query |
| `GET` | `/api/search/saved` | List user's saved searches |
| `DELETE` | `/api/search/saved/:id` | Delete saved search (owner only) |
| `POST` | `/api/search/saved/:id/run` | Re-execute saved search |

```bash
# Save
curl -X POST .../api/search/saved \
  -d '{"name": "OOM incidents", "query": "oom killed", "mode": "hybrid"}'

# Re-run
curl -X POST .../api/search/saved/7/run
```

---

## MCP `search` tool

Agents call the `search` MCP tool which routes to hybrid or legacy FTS based on params.

**Schema excerpt:**

```json
{
  "name": "search",
  "inputSchema": {
    "required": ["q"],
    "properties": {
      "q":            { "type": "string" },
      "mode":         { "type": "string", "enum": ["hybrid","fts","semantic"] },
      "space":        { "type": "string", "description": "space slug" },
      "template_key": { "type": "string" },
      "tags":         { "type": "array", "items": { "type": "string" } },
      "limit":        { "type": "number" }
    }
  }
}
```

**Example agent call:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {
      "q": "redis connection refused",
      "mode": "semantic",
      "template_key": "runbook",
      "limit": 5
    }
  }
}
```

Backward compat: callers passing only `q`/`kind`/`service`/`limit` (no `mode`/`space`/`tags`)
continue to hit the original FTS path unchanged.

---

## Debugging

Enable `SEARCH_DEBUG=1` to log service-hint detection and ambiguity warnings.

Each `HybridSearchHit` exposes diagnostic fields:

| Field | Meaning |
|---|---|
| `source` | `"hybrid"` both lists, `"fts"` keyword-only, `"semantic"` vector-only |
| `ftsRank` | Raw `ts_rank_cd` value from PostgreSQL (undefined if vector-only) |
| `vectorRank` | 1-based position in cosine-distance list (undefined if FTS-only) |
| `rrfScore` | Final merged score — sort key |

Example: if `source="fts"` and `vectorRank` is undefined, TEI was unreachable or kill-switch active.

---

## Fallback behavior

1. TEI unreachable at embed time → `embeddingProvider.embed()` throws → caught, vector branch returns `[]`
2. Vector SQL query fails (e.g. pgvector not installed) → caught, returns `[]`
3. Both fallbacks produce a clean FTS-only result set; no 500 propagated to caller
4. `SEARCH_MODE=fts-only` → vector branch never attempted (no HTTP call to TEI)

---

## Limitations

- **2000-char embed cap:** queries longer than 2000 chars are truncated before embedding
- **Cold-start recall:** ivfflat index recall degrades until `ANALYZE embeddings` runs after bulk ingest
- **Artifacts only:** hybrid search covers artifact_versions; skills use FTS-only path (`search()`)
- **Dept-scoped:** hybrid always filters by `department_id`; cross-dept search requires `bypassDeptFilter` (system callers only)
