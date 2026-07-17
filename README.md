# OneMCP

Internal MCP server for engineering departments — v1 pilot Kỹ thuật. Status: **v1 pilot-ready**.

**Primary use case:** bug-trace KB reuse. Dev A fix bug → agent submit KB via MCP → Dev B (tuần sau) paste error → MCP `search` → hit KB → apply fix trong phút.

## Stack

- **Backend**: NestJS 10 + TypeScript. MCP JSON-RPC 2.0 over HTTP. TypeORM + Zod validation.
- **Portal**: Next.js 15 App Router + Tailwind + react-markdown (rehype-sanitize).
- **DB**: PostgreSQL 16 (pgvector image) + FTS (unaccent + pg_trgm).
- **Object store**: MinIO — attachments 100MB cap, Content-Type whitelist.
- **Queue**: Redis 7 + BullMQ (skill sync worker).
- **Monitoring**: Prometheus `/metrics`, structured pino logs.

## Features shipped

- ✅ **P1 Access**: IP CIDR + trust header identity, RBAC (viewer/contributor/maintainer/dept-admin/super-admin), audit events.
- ✅ **P2 Skills**: git-sync from GitLab mono-repo, manifest schema (static-only v1), MCP `list_skills` + `load_skill` với load event audit, portal list/detail.
- ✅ **P3 Artifacts**: report/research/kb CRUD, versioning (append-only), review workflow (pending → published), MinIO attachments (multipart proxy), optimistic locking updates.
- ✅ **P4 Search**: FTS unaccent-aware (Vietnamese diacritic-insensitive) + trigram fuzzy title. MCP `search` tool.
- ✅ **P5 Templates**: Zod schemas per type, structured content, body auto-compile, MCP `get_artifact_template`.
- ✅ **P5.2 Client hook**: Python PreCompact reminder script + seed skills (session-wrapup, debug-guide).
- ✅ **P6.1 Hardening**: Prometheus metrics + HTTP instrumentation, deep `/ready` (Postgres + MinIO), daily backup service (pg_dump + MinIO mirror).

## MCP tools (7)

| Tool | Purpose |
|---|---|
| `list_skills` | Enumerate skills dept-scoped |
| `load_skill` | SKILL.md content + audit log |
| `list_artifacts` | Enumerate artifacts (published + own pending) |
| `get_artifact` | Fetch artifact body + metadata |
| `get_artifact_template` | Schema for type (report/research/kb) |
| `submit_artifact` | Create pending artifact with structured validate |
| `search` | FTS across skills + artifacts |

## Documentation

- [System Architecture](./docs/system-architecture.md)
- [Code Standards](./docs/code-standards.md)
- [Development Roadmap](./docs/development-roadmap.md) — completion status
- [Staging Deployment Guide](./docs/staging-deployment-guide.md)
- [Backup & Restore](./docs/backup-restore.md)
- [Monitoring](./docs/monitoring.md)
- [Client Session Wrap-Up](./docs/client-session-wrapup.md) — Claude Code hook install

## Quick Start (dev — Linux/macOS/WSL)

```bash
cp .env.example .env
# Fill USER_ALLOW_CIDR, ADMIN_ALLOW_CIDR, MINIO_ROOT_PASSWORD, POSTGRES_PASSWORD

docker compose up -d
docker compose logs backend --tail=30

# Portal: https://localhost (self-signed TLS — accept warning)
# Backend health: curl -k https://localhost/health
# MCP endpoint: https://localhost/api/mcp
# Metrics: curl -k https://localhost/metrics
```

## Verify smoke test

```bash
# List MCP tools
curl -sk -X POST -H "X-Onemcp-User: alice" -H "Content-Type: application/json" \
  https://localhost/api/mcp \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools[].name'
# Expect 7 tools

# Search
curl -sk "https://localhost/api/search?q=test" -H "X-Onemcp-User: alice" | jq

# Ready deep-check
curl -sk https://localhost/ready | jq
```

## Structure

```
backend/          NestJS backend (16 modules)
portal/           Next.js portal (skills, artifacts, search, review UI)
ops/
├── nginx/        Reverse proxy config
├── postgres/     Init SQL
└── backup/       Daily backup container
hooks/            Client-side scripts (Claude Code PreCompact)
skills-samples/   Seed content for skills-kythuat GitLab repo
docs/             Project documentation
plans/            Implementation plans + session reports
```

## Client-side (Claude Code MCP)

Add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "onemcp": {
      "type": "http",
      "url": "https://onemcp.local/api/mcp",
      "headers": { "X-Onemcp-User": "your-username" }
    }
  }
}
```

See [docs/client-session-wrapup.md](./docs/client-session-wrapup.md) for pre-compact hook install.

## Roadmap (post-v1)

- **P4.2**: pgvector semantic embeddings + hybrid rank (needs embedding infra decision).
- **Auth v2**: SSO integration (INET/GitLab OIDC) — separate plan.
- **P6.2**: log rotation, off-site backup automation, alert deploy.

## License

Internal INET — not for external distribution.
