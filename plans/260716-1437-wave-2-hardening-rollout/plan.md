---
title: OneMCP — Wave 2 Hardening & Rollout
slug: wave-2-hardening-rollout
created: 2026-07-16
status: pending
blockedBy: [260716-1112-onemcp-department-mcp-server]
blocks: [260716-1437-wave-3-ai-native-features]
roadmap: ../../docs/development-roadmap.md
---

# Wave 2 — Hardening + Multi-Dept Rollout

**Timeframe:** Tháng 3-6 (sau v1 pilot 30 ngày).
**Trigger:** v1 exit criteria đạt (≥10 KB, top-3 recall, ≥3 case reuse documented).
**Estimated:** ~9 tuần / 2 dev.

Blocked bởi v1 — phase files chi tiết sẽ viết khi v1 kết thúc và feedback pilot đã thu.

## Objective
Khắc phục pain points từ v1 pilot, expand sang 2-3 dept, đảm bảo compliance KB submission đạt ≥95%.

## Success Metrics
- ≥3 dept adopt (từ 1 → 3+).
- Session compliance ≥95% (submit_artifact hoặc skip_artifact) — từ ~80% v1.
- Feedback data (thumbs up/down, time-saved survey) collected trên ≥50% KB view.
- Zero critical bug từ multi-dept RBAC.

## Phases (planned, chi tiết sau)

| # | Phase | Rationale | Est. |
|---|---|---|---|
| W2-P1 | [Client-side hard enforcement](./phase-01-client-side-enforcement.md) — Claude Code stop-hook script verify submit trước end session | Prompt-only ~80%, không đủ bảo vệ ROI use case chính | 1w |
| W2-P2 | [Multi-dept rollout](./phase-02-multi-dept-rollout.md) — mở Support/DevOps/PM, cross-dept sharing rules | Justify đầu tư v1 | 2w |
| W2-P3 | [Bug pattern detection](./phase-03-bug-pattern-detection.md) — agent detect `fix:` commit, ck:debug usage → nudge KB submit | Tăng bug-fix KB coverage cụ thể | 1w |
| W2-P4 | [KB feedback loop](./phase-04-kb-feedback-loop.md) — thumbs, "tiết kiệm bao nhiêu giờ" survey, author reputation | Data-driven quality | 2w |
| W2-P5 | [Search analytics](./phase-05-search-analytics.md) — dashboard popular query, zero-result → KB gap detection | Content strategy | 1w |
| W2-P6 | [Rate limits & quotas](./phase-06-rate-limits.md) — per-user, per-PAT, per-dept | Prevent abuse khi scale | 1w |
| W2-P7 | [Admin ops bulk](./phase-07-admin-ops-bulk.md) — bulk role assign, dept template clone | UX admin multi-dept | 1w |

## Priority Ordering
1. **W2-P1** (Tier S) — must-do đầu tiên. Không có = compliance regression.
2. **W2-P2** — parallel với W2-P1 (backend + infra tách biệt).
3. **W2-P3, W2-P4** — sequential sau P1 (cần enforce trước rồi feedback).
4. **W2-P5, W2-P6, W2-P7** — parallel cuối wave.

## Cross-Wave Concerns
- **Multi-dept schema:** đã ready từ v1 (`department_id NOT NULL`), P2 chỉ cần seed dept + role mapping.
- **Data migration:** không có (v1 chỉ Kỹ thuật), nhưng cross-dept sharing cần audit trail rõ.
- **Backward compatibility:** MCP tools API v1 giữ nguyên, chỉ mở rộng dept scope trong RBAC.

## Decision Gate (trước khi start Wave 2)
- v1 pilot đã chạy đủ 30 ngày?
- ≥10 KB submit? Nếu không → refocus P1+P3 (enforcement + nudging) trước, hoãn multi-dept.
- Search recall test top-3 ≥70%? Nếu không → move Wave 3.6 (fine-tune embed) lên Wave 2.

## Detailed Phase Files
Sẽ viết khi decision gate pass. File placeholder có thể tạo lúc đó với `/ck:plan` cho từng phase.

## Unresolved
- Dept nào rollout trước (Support / DevOps / PM)?
- Team dev có scale up sau v1?
- Budget cho Claude Code enterprise deployment (stop-hook cần enterprise features)?
