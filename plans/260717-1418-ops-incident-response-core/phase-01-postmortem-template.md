---
phase: 01
name: Post-mortem template
status: completed
effort: 0.5 day
priority: P0
---

# Phase 01 — Post-mortem template

## Context

Hiện template `report` quá generic. Ops post-mortem cần fields cụ thể: timeline, blast radius, 5-whys, action items, severity. Chuẩn hoá format giúp reuse và pattern spotting cross-incident.

## Requirements

**Functional:**
- Thêm artifact type `postmortem` vào `ARTIFACT_TYPES` enum
- Template fields:
  - `incident_id` (text, required) — INC-yyyymmdd-N hoặc external
  - `severity` (text, required) — SEV1|SEV2|SEV3
  - `date_occurred` (text, required) — ISO date
  - `duration_minutes` (text, required)
  - `summary` (markdown, required, min 50)
  - `timeline` (markdown, required, min 100) — event log timestamp-prefixed
  - `blast_radius` (markdown, required, min 30) — services + user impact
  - `root_cause` (markdown, required, min 50) — 5-whys chain
  - `detection_gap` (markdown, optional) — why not caught sooner
  - `remediation` (markdown, required, min 30)
  - `action_items` (markdown, required, min 30) — owner + due checklist
  - `lessons_learned` (markdown, optional)
- Body compile: sections render Markdown h2 headers theo thứ tự fields

**Non-functional:**
- Template version=1
- Không migration DB — chỉ thêm value trong enum union type (string check)

## Related files

**Modify:**
- `backend/src/artifacts/artifact-type.enum.ts` — thêm `'postmortem'`
- `backend/src/artifacts/templates/template-registry.ts` — register template + fields
- `backend/src/mcp/mcp-tools.service.ts` — cập nhật `enum` trong tool schemas cho `submit_artifact`, `list_artifacts`, `get_artifact_template`
- `portal/lib/api/artifacts.ts` + `templates.ts` — cập nhật type union nếu có

## Implementation steps

1. Extend `ArtifactType` union + `ARTIFACT_TYPES` array with `'postmortem'`
2. Add template object trong `template-registry.ts` với 12 fields definitions
3. Update tool `enum` values 3 chỗ trong `mcp-tools.service.ts`
4. Portal type sync
5. `pnpm build` verify no TS errors
6. Test: `GET /api/artifact-templates/postmortem` return schema đúng, `submit_artifact type=postmortem` với payload đủ fields work

## Todo

- [ ] Extend enum + array
- [ ] Register template với 12 fields
- [ ] Update MCP tool schemas 3 chỗ
- [ ] Portal type sync
- [ ] Build clean
- [ ] Curl test: GET template + POST submit
- [ ] Seed 1 sample postmortem via portal to verify body compile output

## Success criteria

- MCP `get_artifact_template postmortem` return đầy đủ 12 fields
- Submit postmortem thành công, body compile sections đẹp trong `<MarkdownView>`
- Portal list filter type=postmortem hoạt động
- No regression cho `report/research/kb`

## Risks

| Risk | Mitigation |
|---|---|
| Field quá nhiều làm ops ngại điền | Chỉ 8/12 required; optional để linh hoạt |
| Timeline format tự do khó parse sau này | Recommend format `HH:MM - event` nhưng free-form, Phase sau semantic search bù |

## Red Team Redlines (2026-07-17)

- **[RT-13, High] Cut required fields to 4:** `summary`, `timeline`, `root_cause`, `action_items`. Move `incident_id/severity/date_occurred/duration_minutes/blast_radius/remediation` to optional. Drop `min N chars` validation entirely (soft-warn only). Reason: ops at 2am hits char-count walls and abandons drafts → zero adoption. Add fields back post-pilot after seeing what ops actually write.

<!-- Updated: Validation Session 1 (V6) — confirmed 4 required fields; drop min-char entirely -->
