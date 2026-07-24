# OneMCP API Keys

API keys let external clients (LLM tools, CI pipelines, scripts) authenticate to OneMCP without the trust-header mechanism. Each key is scoped to a user and carries that user's department + role.

## Key format

```
omk_<prefix8>_<random56hex>
```

- Prefix: `omk_` + 8 hex chars = 12 chars total (e.g. `omk_3f9a1b2c`)
- Full key: `omk_` + 64 hex chars total
- Returned **exactly once** on creation — OneMCP stores only the bcrypt hash

## Create a key

```
POST /api/api-keys
X-Onemcp-User: alice
Content-Type: application/json

{
  "label": "CI pipeline",
  "expires_in_days": 90
}
```

Response (200):

```json
{
  "id": "42",
  "prefix": "omk_3f9a1b2c",
  "key": "omk_3f9a1b2c...<full 64-char key>",
  "expiresAt": "2026-10-22T00:00:00.000Z"
}
```

**Copy the `key` field immediately** — it is not stored in plaintext and cannot be recovered.

Defaults:
- `expires_in_days`: 90 (min 1, max 365)
- `label`: null (optional, free-text description)

## Use a key

Add the `X-Onemcp-Key` header to any API request:

```
GET /api/artifacts
X-Onemcp-Key: omk_3f9a1b2c...<full key>
```

The key middleware runs **before** the trust-header middleware. If a valid key is present, `X-Onemcp-User` is ignored — the key's owner becomes the effective user.

## List keys

```
GET /api/api-keys
X-Onemcp-User: alice
```

Response: array of key metadata (prefix + label + expiry + revoked status). **Hash and full key are never returned.**

## Revoke a key

```
DELETE /api/api-keys/:id
X-Onemcp-User: alice
```

Revocation is immediate — no restart required. The key is invalidated in-memory (evicted from cache) and marked `revoked=true` in DB.

Only the key owner can revoke their own keys. Super-admins can revoke any key via admin CIDR.

## Rate limits

- Default: **60 requests / 60-second sliding window** per key prefix
- Exceeding the limit: the middleware returns `429 Too Many Requests`
- Rate counters reset on service restart (in-memory only)
- Admin-tuned override: not yet exposed via API (Phase 2)

## Expiration

| Setting | Value |
|---|---|
| Default expiry | 90 days from creation |
| Maximum expiry | 365 days |
| Minimum expiry | 1 day |

Expired keys are rejected at verify time — no cron cleanup required.

## Security design

| Property | Implementation |
|---|---|
| Storage | bcrypt hash only (cost=10), plaintext never persisted |
| Hot-path perf | Verified hashes cached in-memory for 60 s per prefix |
| Log safety | Only `key_prefix` appears in logs — never full key |
| List responses | Only `key_prefix` + metadata — no hash exposure |
| Revocation scope | Per-key, immediate (cache evict + DB flag) |
| Collision resistance | 56 hex chars of entropy (~224 bits) beyond prefix |

## Middleware chain order

```
1. IP CIDR guard          (global allow-list)
2. API key middleware      (X-Onemcp-Key → set req.user)
3. Trust header middleware (X-Onemcp-User fallback, skipped if key already set req.user)
4. Auth guard              (require req.user present)
```

The API key middleware short-circuits the trust-header path — if both headers are present, the key wins.

## Claude Code / MCP config example

```json
{
  "mcpServers": {
    "onemcp": {
      "url": "https://onemcp.example.com/api/mcp",
      "headers": {
        "X-Onemcp-Key": "omk_3f9a1b2c..."
      }
    }
  }
}
```
