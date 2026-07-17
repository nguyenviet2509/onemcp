# OneMCP Code Standards

Áp dụng cho **backend** (NestJS/TypeScript) + **portal** (Next.js/TypeScript) + **ops** (bash/Dockerfile).

## Filename conventions

- **TS/JS/Python/shell**: kebab-case với descriptive tên. Cho phép dài (`skill-sync.processor.ts`) — LLM tools (Grep/Glob) đọc tốt hơn.
- **Markdown**: kebab-case.
- **Docker**: `Dockerfile` (canonical). Nếu cần variant → `Dockerfile.prod`.

## File size

- Target < 200 LOC per file. > 300 LOC → split.
- Exception: DTOs, entities collections, docs.

## Module layout (NestJS)

```
src/<feature>/
├── entities/              # TypeORM entity classes
├── dto/                   # Zod schemas + inferred types
├── <feature>.service.ts   # Business logic + RBAC
├── <feature>.controller.ts  # Thin — validation + delegate
├── <feature>.module.ts    # Wire deps + exports
└── sub-modules/           # (khi feature grow)
```

## Controllers

- **Thin**: parse + validate + call service. Không có business logic.
- Zod safeParse → throw BadRequestException với chi tiết errors.
- Rate limit qua `@Throttle({ default: { limit, ttl } })` per-endpoint.
- Route naming: kebab-case, RESTful (`GET /api/artifacts`, `POST /api/artifacts/:id/review`).

## Services

- **RBAC ở service layer**, không controller.
- Multi-tenant: mọi query MUST WHERE `department_id = user.departmentId`.
- Transactions cho multi-row writes (`ds.transaction()`).
- Prefer named methods > passing DTO shape khắp nơi.
- Metrics wire ở đây (không middleware, không controller).

## Entities

- Snake_case cột trong DB (`department_id`), camelCase field TS (`departmentId`).
- `@Index` bắt buộc cho FK + query columns.
- `@Unique` cho constraints.
- Enum values as union type `'active' | 'deprecated'` — không TypeScript enum (bloat).

## Migrations

- Timestamp prefix (17203xxx-...): monotonic.
- Idempotent `IF EXISTS` cho drops.
- `.down()` bắt buộc — CI test round-trip P6.2 backlog.

## Error handling

- Domain errors → NestJS HTTP exceptions (`BadRequestException`, `ForbiddenException`, `ConflictException`, `NotFoundException`).
- 5xx = server bug; 4xx = client bug. Không throw generic Error.
- User-facing messages tiếng Việt hoặc English — consistent per feature.

## Logging

- Pino structured (JSON). Log level control qua `LOG_LEVEL` env.
- **Redact** sensitive: `authorization`, `cookie`, `X-Onemcp-User`, tokens, passwords.
- Không log full request body — chỉ metadata (method + path + status).
- Warnings dùng level 40 (`this.log.warn`) — error level 50.

## Security

- **Không log** X-Onemcp-User content (redact).
- **Whitelist** thay blacklist khi validate (content-type, file extensions, role names).
- **timingSafeEqual** cho HMAC/secret compare.
- **URL rewrite** cho deploy tokens (`oauth2:$TOKEN@` — không log).
- Fail fast: `validateEnv()` boot.

## Zod schemas

- Colocation: `dto/<feature>.dto.ts` — schema + inferred type.
- `.safeParse` (không `.parse`) — throw BadRequestException với errors serialize.
- Constraint tight: min/max/regex ở boundary. Truy internal free.

## Tests (P6.2 backlog)

- Unit: `.spec.ts` colocation. Cover pure functions + validators.
- Integration: `test/*.e2e-spec.ts` với real Postgres (Testcontainers).
- Coverage target: > 60% for critical paths (auth, RBAC, mutations).

## Frontend (Next.js)

- App router (`app/`) — server components default, `'use client'` opt-in.
- Client fetch qua `lib/api/<feature>.ts` — typed wrappers around `apiFetch`.
- Dynamic form generation từ backend schema (see `structured-editor.tsx`).
- Markdown render qua `MarkdownView` (rehype-sanitize) — không dangerouslySetInnerHTML raw.
- Tailwind utility-first. Reuse `nav.tsx` layout. Dark mode support via `dark:` prefix.

## Git conventions

- Conventional commits: `feat(scope): message`, `fix:`, `docs:`, `refactor:`, `chore:`.
- **No AI references** in commit messages (per team preference).
- Sacrifice grammar for concision in commit body — bullet key changes.
- Report file per session: `plans/reports/{type}-{date}-{slug}.md`.

## PR requirements (P6.2 backlog)

- Green lint + build.
- Reference plan phase file khi implement.
- Docs impact declared (none|minor|major).
- Rollback plan cho migrations.

## YAGNI - KISS - DRY

- Don't add feature "just in case". Ship minimal.
- Extract abstraction chỉ khi ≥ 3 use sites.
- Free-form body + structured template = 2 paths — chấp nhận vì use case khác nhau.
- Avoid premature optimization (index everything, cache everything).

## Anti-patterns

- ❌ Business logic in controller.
- ❌ Cross-dept query without WHERE department_id.
- ❌ Skipping `.down()` migration.
- ❌ Silent catch — always log + rethrow hoặc explicit ignore.
- ❌ Hardcoded secrets — always env.
- ❌ Reflect on request path in guard/middleware without whitelist.
