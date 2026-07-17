# OneMCP

Internal MCP server for departments — v1 pilot Kỹ thuật.

Primary use case: bug-trace KB reuse. Dev A resolve bug → viết KB → Dev B (sau này) paste error → tìm ra KB → apply fix.

## Stack
- **Backend:** NestJS + TypeScript (MCP streamable HTTP+SSE)
- **Portal:** Next.js 15 + shadcn/ui
- **DB:** PostgreSQL 16 + pgvector + FTS (unaccent)
- **Object store:** MinIO (S3-compat)
- **Queue:** Redis + BullMQ
- **Embedding:** multilingual-e5-small ONNX (CPU)

## Access Control (v1)
Auth full defer sang plan `plans/260716-1451-auth-integration/`.
V1 dùng IP CIDR allowlist + `X-Onemcp-User` trust header (mode B).

## Documentation
- [Plan v1](./plans/260716-1112-onemcp-department-mcp-server/plan.md)
- [Development Roadmap](./docs/development-roadmap.md)
- [System Architecture](./plans/260716-1112-onemcp-department-mcp-server/mockups/system-architecture.html)

## Quick Start (dev)
```bash
cp .env.example .env
docker compose up -d
# Portal: https://localhost
# Backend health: https://localhost/api/health
```

## Structure
```
backend/    NestJS backend
portal/     Next.js portal
ops/        Infra configs (postgres, nginx, minio)
docs/       Project documentation
plans/      Implementation plans
```

## License
Internal INET — not for external distribution.
