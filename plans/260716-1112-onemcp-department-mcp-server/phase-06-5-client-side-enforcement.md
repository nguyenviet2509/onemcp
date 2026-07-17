# Phase 06.5 — Client-side Hard Enforcement

**Priority:** High (bảo vệ ROI use case chính)
**Status:** pending
**Est.:** 1 tuần
**Depends on:** P5 (submit_artifact/skip_artifact tools ready), P6 (audit viewer)

## Overview
Bổ sung sau red-team review (finding C5). Session-wrapup skill (soft prompt) không đủ đảm bảo compliance. Thêm **Claude Code stop-hook script** verify submit_artifact/skip_artifact được gọi trước khi end session, cứng hoá enforcement.

## Rationale
- Primary use case (bug-trace KB reuse) phụ thuộc vào KB submission volume.
- Soft prompt qua session-wrapup skill dự kiến compliance ~80%.
- Hard hook nâng lên ~95% → bảo vệ ROI use case.
- Chuyển từ Wave 2.1 (originally planned) → v1 sau red-team → cost thêm 1 tuần nhưng critical.

## Key Insights
- Claude Code có hook system trong `~/.claude/settings.json` (SessionStart, UserPromptSubmit, Stop, PreToolUse, PostToolUse).
- **Stop hook** = script chạy khi session end (Ctrl+D, /exit, disconnect).
- Hook script query OneMCP API check: session ID này có submit_artifact hoặc skip_artifact chưa?
- Nếu không → prompt user (blocking) buộc submit hoặc skip-with-reason.

## Requirements

### Functional
- **Session ID tracking backend:**
  - Backend accept `X-Onemcp-Session-Id` header từ MCP client → dedup per session.
  - Endpoint `GET /me/session/:id/status` → return `{ has_submit: bool, has_skip: bool, activity_summary }`.
- **Stop hook script (Node.js hoặc bash):**
  - Install qua session-wrapup skill's resources.
  - Đọc session ID từ `~/.claude/current-session.json` (Claude Code standard).
  - Curl backend check status.
  - Nếu chưa submit/skip → interactive prompt: "Session này có finding worth documenting? [Y/n]".
  - Y → invoke `claude "run submit_artifact"` hoặc mở portal.
  - n → gọi skip_artifact với reason.
- **Kỹ thuật global CLAUDE.md** mandatory include session-wrapup skill + stop hook config.

### Non-Functional
- Hook không block > 30s khi backend unreachable.
- Fail-open: nếu backend timeout → session end bình thường, log local, retry sau.
- Không phá vỡ CI/CD sessions (agent flag `--non-interactive` skip hook).

## Architecture

```
┌─────────────────────────────────────┐
│  Claude Code CLI                    │
│  ~/.claude/settings.json            │
│    stop: onemcp-wrapup-check.sh     │
└──────────────┬──────────────────────┘
               │ on Stop event
               ▼
┌─────────────────────────────────────┐
│  onemcp-wrapup-check.sh             │
│  1. Read $CLAUDE_SESSION_ID         │
│  2. curl GET /me/session/:id/status │
│  3. If !has_submit && !has_skip:    │
│     prompt user + block             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  OneMCP Backend                     │
│  session_activity table             │
│  aggregate submits/skips per        │
│  session_id + user_id               │
└─────────────────────────────────────┘
```

## Related Code Files (to create)

### backend/
```
src/sessions/
├── sessions.module.ts
├── entities/session-activity.entity.ts        # session_id, user_id, submits[], skips[], ts
├── session-tracker.middleware.ts              # capture X-Onemcp-Session-Id
├── sessions.service.ts                        # aggregate + status query
└── sessions.controller.ts                     # GET /me/session/:id/status

src/db/migrations/1720500000000-sessions.ts

# Update submit_artifact + skip_artifact tools → link session_id
src/artifacts/artifacts.service.ts             # accept session_id, insert activity
```

### skills-kythuat repo (skill session-wrapup mở rộng)
```
skills/session-wrapup/
├── manifest.yaml                              # add resource stop-hook script
├── SKILL.md                                   # update instruction
└── resources/
    ├── report-template.md
    ├── research-template.md
    ├── kb-template.md
    ├── stop-hook/
    │   ├── onemcp-wrapup-check.sh              # main hook script
    │   ├── onemcp-wrapup-check.ps1             # Windows variant
    │   └── install.sh                          # add to ~/.claude/settings.json
    └── README.md
```

### docs/
```
docs/session-enforcement-guide.md              # dev install guide
```

## Implementation Steps

1. **DB migration** — `session_activity` table: `id, session_id, user_id, submitted_artifact_ids[], skipped_reasons[], started_at, last_activity_at`.
2. **Session tracker middleware** — parse `X-Onemcp-Session-Id`, upsert row on any MCP request.
3. **Modify submit_artifact + skip_artifact tools** — accept session_id, append to session_activity.
4. **REST endpoint** `GET /me/session/:id/status` — return submit/skip status.
5. **Stop hook script** (`onemcp-wrapup-check.sh`):
   - Read env `CLAUDE_SESSION_ID` hoặc `~/.claude/state/current-session`.
   - `curl -s -H "X-Onemcp-User: $USER" $ONEMCP_URL/me/session/$SESSION_ID/status`.
   - Parse JSON, decide.
   - Nếu chưa → prompt bằng `read -p` interactive, gọi `claude` CLI hoặc `open $ONEMCP_URL/artifacts/new`.
   - Timeout 30s fail-open.
6. **PowerShell variant** cho Windows dev.
7. **Install script** — chèn hook config vào `~/.claude/settings.json`.
8. **Update session-wrapup skill** — bundle hook scripts as resources, SKILL.md instruct install.
9. **Global CLAUDE.md Kỹ thuật** — mandatory rule reference session-wrapup + stop hook.
10. **Test scenarios:**
   - Session có submit → hook silent pass.
   - Session không submit → prompt hiển thị, chọn skip → skip_artifact fired.
   - Backend down → hook fail-open, log warning.
   - Non-interactive mode (`--ci`) → skip hook.

## Todo
- [ ] Session activity migration
- [ ] Session tracker middleware
- [ ] Modify artifact tools accept session_id
- [ ] Session status REST endpoint
- [ ] Stop hook script (bash + ps1)
- [ ] Install script
- [ ] Update session-wrapup skill resources
- [ ] Kỹ thuật global CLAUDE.md rule
- [ ] Docs: session-enforcement-guide.md
- [ ] Test 4 scenarios
- [ ] Rollout: install hook cho pilot dev list

## Success Criteria
- ≥ 95% session Kỹ thuật kết thúc có submit_artifact hoặc skip_artifact (từ ~80% soft-prompt).
- Hook không gây friction (<30s prompt time trong 99% case).
- Non-interactive CI sessions skip hook đúng cách.
- Backend down không block dev workflow.

## Risk Assessment
- **Hook script bug crash CLI** → mitigation: timeout hard + fail-open + logs.
- **Dev disable hook manually** → detect qua audit: session_id qua MCP mà không có hook check → alert.
- **Windows vs macOS/Linux hook UX khác** → test cả 3 OS trước rollout.
- **Non-interactive session detection** → dùng `-t 0 <&0` check TTY hoặc env `CI=true`.

## Security Considerations
- Hook script chạy user-space, không cần sudo.
- Fail-open không thành security backdoor (chỉ tăng compliance, không phải auth).
- Backend endpoint `/me/session/:id/status` chỉ trả cho current user (trust header check).

## Rollout Plan
1. Tuần 1: implement + test staging.
2. Tuần 1 (weekend): install hook cho 2 dev champion.
3. Tuần 2: 5-10 dev tiếp theo.
4. Sau 2 tuần: mandatory cho toàn Kỹ thuật.
5. Metric review sau 30 ngày: compliance rate + friction feedback.

## Next Steps
- Đo compliance rate trong P6 monitoring dashboard.
- Nếu <90% compliance sau 30 ngày → tăng cường thêm nudge (Wave 2 bug pattern detection).
