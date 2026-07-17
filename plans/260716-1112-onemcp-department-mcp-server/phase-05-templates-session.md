# Phase 05 — Templates & Session Enforcement

**Priority:** Medium
**Status:** pending
**Est.:** 1 tuần
**Depends on:** P3 (submit_artifact tool), P2 (skills loader)

## Overview
Ép AI agent viết report/research/KB theo template thống nhất qua 2 lớp: (1) MCP prompt resource cho agent học format, (2) JSON schema validate ở `submit_artifact`. Đóng gói `session-wrapup` skill mandatory instruct agent submit artifact trước khi kết thúc phiên.

## Key Insights
- **Prompt guide + schema enforce** đều cần — chỉ prompt: agent bỏ qua; chỉ schema: agent viết lộn xộn rồi bị reject phải retry nhiều.
- **Session-wrapup phải là skill mandatory** — global CLAUDE.md của phòng Kỹ thuật include skill này ở system prompt.
- **Skip-with-reason** — không phải phiên nào cũng có finding worth submit; cho phép agent gọi `skip_artifact(reason)` để log audit.

## Requirements

### Functional
- 3 template JSON schema: `report.schema.json`, `research.schema.json`, `kb.schema.json`.
- MCP resource endpoint expose templates + example artifacts.
- Portal admin CRUD templates (versioned).
- `submit_artifact` reject nếu payload không match schema, error message có JSON pointer + hint.
- `session-wrapup` skill trong `skills-kythuat` repo:
  - MCP prompt/instruction: "Trước khi end session, gọi `submit_artifact` với finding hoặc `skip_artifact(reason)`".
  - Optionally: hook client-side (Claude Code stop hook) nếu deploy CLI.
- `skip_artifact` MCP tool → log audit event kind=`session_skip_artifact`.

### Non-Functional
- Template update không break artifact cũ (template_version field trong structured).
- Schema doc auto-generate cho portal help page.

## Architecture

```
[Agent session start]
        │
        │ load skill `session-wrapup` → prompt injected
        │ load resource `artifact-templates/report.md` (nếu cần)
        ▼
[Agent làm việc]
        │
        │ submit_artifact({ template_version:'report@1.0', ... })
        ▼
[TemplateValidator] ── Ajv validate against report.schema.json
        │
        ├─ valid  ─► P3 flow (create version, enqueue embed)
        └─ invalid ─► return { error, pointer, hint }
        │
[Agent end session]
        │
        │ session-wrapup skill instruction:
        │  → submit_artifact HOẶC skip_artifact(reason)
        ▼
[audit_events]
```

## Related Code Files (to create)

### backend/
```
src/templates/
├── templates.module.ts
├── entities/template.entity.ts                # id, kind, version, schema jsonb, active
├── templates.service.ts
├── templates.controller.ts                    # admin CRUD
├── template-validator.service.ts              # Ajv
└── seed-templates.ts                          # bootstrap 3 default

src/mcp/resources/
├── template.resource.ts                       # expose templates as MCP resources
└── example-artifact.resource.ts

src/mcp/tools/
├── skip-artifact.tool.ts
└── (modify) submit-artifact.tool.ts           # inject validator

src/db/migrations/1720400000000-templates.ts
```

### skills repo (`gitlab/onemcp/skills-kythuat`)
```
skills/session-wrapup/
├── manifest.yaml
├── SKILL.md                                   # instruction cho agent
└── resources/
    ├── report-template.md
    ├── research-template.md
    └── kb-template.md
```

### portal/
```
app/admin/templates/
├── page.tsx                                   # list templates
├── [id]/edit/page.tsx                         # jsonschema editor
└── new/page.tsx

app/help/templates/page.tsx                    # public doc auto-gen
```

## Template Schemas (v1 sketch)

### report.schema.json (excerpt)
```json
{
  "type": "object",
  "required": ["title", "template_version", "summary", "sections", "tags"],
  "properties": {
    "title": { "type": "string", "minLength": 5, "maxLength": 200 },
    "template_version": { "const": "report@1.0" },
    "summary": { "type": "string", "minLength": 20, "maxLength": 1000 },
    "sections": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object",
        "required": ["heading", "body"],
        "properties": {
          "heading": { "type": "string" },
          "body": { "type": "string", "minLength": 10 }
        }
      }
    },
    "tags": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "references": { "type": "array", "items": { "type": "string", "format": "uri" } },
    "unresolved_questions": { "type": "array", "items": { "type": "string" } }
  }
}
```

### research.schema.json — thêm `hypothesis`, `methodology`, `findings`, `conclusion`.

### kb.schema.json — cấu trúc tối ưu cho bug-trace/resolution recall
Required: `title`, `template_version`, `problem`, `symptoms`, `root_cause`, `solution`, `applicability`, `tags`.
Optional: `code_snippet`, `related_kb[]`, `references[]`, `attachments[]`.

- `symptoms[]` (array of string, minItems 1) — error message, stack trace, log line, HTTP status, exit code. **Đây là field crucial cho search recall** khi dev sau paste error message.
- `code_snippet` (object, optional) — `{ language, code }` cho fix snippet ngắn.
- `root_cause` (string, minLength 20) — giải thích tại sao lỗi xảy ra.
- `solution` (string, minLength 20) — cách fix cụ thể + validation steps.
- `applicability` (string) — phạm vi áp dụng (service/version/env).

Rationale: KB thường được tra bằng cách paste error message → symptoms match exact ăn điểm hơn semantic paraphrase. Root cause + solution tách riêng để agent trích xuất chính xác.

## Implementation Steps

1. **DB migration** — templates table: id, kind ENUM, version, schema jsonb, active bool, created_at.
2. **Seed defaults** — 3 template rows từ JSON files trong `src/templates/defaults/`.
3. **Ajv validator service** — compile schemas cached; return `{ valid, errors[] }`.
4. **Modify submit_artifact tool** — call validator trước khi tạo version; return structured error nếu invalid.
5. **skip_artifact tool** — args: `reason` string. Log audit event, không tạo artifact.
6. **MCP resources** — expose `template://report@1.0`, `template://research@1.0`, `template://kb@1.0`, kèm example artifacts.
7. **Templates admin CRUD** — portal edit schema (Monaco editor với JSON schema linter), version bump khi save.
8. **session-wrapup skill** — write SKILL.md + manifest, publish to skills-kythuat repo.
9. **Portal help page** — auto-render schema thành readable doc (dùng `json-schema-to-typescript` hoặc `docson`).
10. **E2E** — agent flow: load session-wrapup → submit_artifact invalid → error hint → fix → valid submit succeed.

## Todo
- [ ] Templates migration
- [ ] Seed 3 default schemas (report, research, kb)
- [ ] Ajv validator service
- [ ] Modify submit_artifact to validate
- [ ] skip_artifact MCP tool
- [ ] MCP resource providers (templates + examples)
- [ ] Portal admin templates CRUD + Monaco editor
- [ ] Portal help auto-gen page
- [ ] Author session-wrapup skill (SKILL.md + manifest)
- [ ] Publish skill via MR
- [ ] Global CLAUDE.md for Kỹ thuật referencing session-wrapup
- [ ] E2E validation flow
- [ ] Compile check

## Success Criteria
- Submit thiếu field bắt buộc → HTTP 400 với JSON pointer error, agent tự retry được.
- Load `template://report@1.0` qua MCP resource → trả về schema + example.
- Session Kỹ thuật kết thúc phải có submit_artifact hoặc skip_artifact ghi audit.
- Admin update template → version mới, artifact cũ vẫn valid.

## Risk Assessment
- **Agent bypass session-wrapup** → chỉ enforce mềm qua prompt; hard enforce cần client hook (out of scope v1, note P6).
- **Schema quá strict** → v1 giữ minimal required fields; nới lỏng sau feedback.
- **Template versioning conflict** → chỉ 1 version `active=true` per kind; validate map theo `template_version` field trong payload.

## Security Considerations
- Chỉ super-admin edit templates.
- Ajv `ajv-formats` để validate uri/date-time an toàn.
- Reject payload > 2MB trước khi Ajv (tránh DoS).

## Next Steps
- P6 hardening: dashboard % session có submit/skip.
- Long-term: client-side stop hook cho hard enforcement.
