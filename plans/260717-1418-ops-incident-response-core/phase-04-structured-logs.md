---
phase: 04
name: Structured logs field
status: completed
effort: 0.5 day
priority: P1
depends: [phase-01]
---

# Phase 04 — Structured logs field

## Context

Ops post-mortem/runbook thường paste log dài (10-100 dòng). Field `markdown` hiện render kém — không line numbers, không collapse, không copy button. Cần field type mới `logs`.

## Requirements

**Functional:**
- Template field type mới: `logs` (extend `TemplateField.type` union)
- Backend: string storage same as markdown (không cần migration)
- Portal render: monospace pre với:
  - Line numbers left gutter
  - Copy button top-right
  - Collapse toggle nếu > 50 lines (show first 20 + expand)
  - Syntax highlight auto (Shiki hoặc highlight.js — dùng subset languages: bash, sql, json, yaml, log)
- Editor: `<textarea>` monospace, tách hoàn toàn khỏi rich editor (không TipTap trong field logs)
- Body compile: wrap trong ` ```log ` fenced block

**Non-functional:**
- Shiki bundle size — dynamic import chỉ khi có field logs render
- Copy button dùng `navigator.clipboard.writeText`

## Related files

**Modify:**
- `backend/src/artifacts/templates/template-validator.ts` — recognize `type=logs`, compile với fence
- `backend/src/artifacts/templates/template-registry.ts` — dùng type=logs trong postmortem timeline nếu phù hợp, hoặc runbook diagnosis
- `portal/components/structured-editor.tsx` — branch render textarea monospace cho type=logs
- `portal/components/markdown-view.tsx` — không đổi (fence block đã render đúng qua rehype-highlight, chỉ cần thêm plugin nếu chưa)
- `portal/package.json` — thêm `shiki` hoặc `rehype-highlight` + `highlight.js` (nhẹ hơn Shiki cho pilot)

**Create:**
- `portal/components/log-view.tsx` — component render logs với line numbers + copy + collapse

## Field application

Cân nhắc dùng `type=logs` cho:
- Postmortem: field mới `raw_logs` optional
- Runbook: field `verify_command_output_sample` (nếu cần)
- Kb: có thể user tự chọn khi write

## Implementation steps

1. Extend `TemplateField.type` union: `'text' | 'markdown' | 'logs'`
2. `template-validator.ts` — `type=logs` compile block: `\n\n## <label>\n\n\`\`\`log\n{value}\n\`\`\`\n`
3. `template-registry.ts` — postmortem thêm optional `raw_logs` field type=logs
4. Portal editor branch: `logs` → `<textarea class="font-mono">`
5. `log-view.tsx` — 30-line component (pre, line numbers, copy, collapse)
6. Detail page: khi render body markdown, fenced `log` blocks pass qua log-view
7. Test: submit postmortem có raw_logs 100 dòng → detail page hiện line numbers + copy + collapse

## Todo

- [ ] Extend TemplateField.type
- [ ] Validator compile logs fence
- [ ] Add raw_logs field vào postmortem template
- [ ] Portal editor branch
- [ ] `log-view.tsx` component
- [ ] Wire vào detail markdown render (custom code block renderer trong react-markdown)
- [ ] Test 100-line paste

## Success criteria

- Editor: paste log 100 dòng vào field logs → indent giữ nguyên, line breaks đúng
- Detail: line numbers hiện, click copy work, collapse hoạt động

## Risks

| Risk | Mitigation |
|---|---|
| Log > 10K lines làm portal chậm | Cap render 500 lines default, "view raw" link full via download |
| Copy fail trên HTTP dev (không HTTPS) | Fallback `document.execCommand('copy')` |
| Bundle bloat từ highlight lib | Dynamic import only when needed, hoặc dùng highlight.js core + register 5 langs |

## Red Team Redlines (2026-07-17)

- **[RT-14, High] Descope Phase 04 to MVP (or drop entirely).** 0.5d claim vs 1.5-2d realistic scope (new field type + validator + template + `log-view.tsx` + Shiki dynamic import + line numbers + copy button + collapse + HTTP-fallback clipboard + 500-line cap). Ops pain point (monospace + copyable) is already solved by existing `markdown` field with triple-backtick fences via `rehype-highlight`.
  - **Recommended MVP:** add optional `raw_logs` field to postmortem template; validator compiles to ```` ```log ```` fence. STOP. No `log-view.tsx`, no line numbers, no copy button, no collapse. Portal already renders fenced blocks with monospace.
  - Revisit line-numbers/copy/collapse post-pilot only if ops actually complain.
  - If phase is kept as-written, re-estimate to 1.5d and re-check total budget.

<!-- Updated: Validation Session 1 (V7) — MVP selected: add `raw_logs` field only, compile to ```log fence. Drop log-view.tsx, Shiki, line numbers, copy button, collapse. Effort revised 0.5d → 0.2d. -->
