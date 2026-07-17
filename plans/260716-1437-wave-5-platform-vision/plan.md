---
title: OneMCP — Wave 5 Platform Vision
slug: wave-5-platform-vision
created: 2026-07-16
status: pending
blockedBy: [260716-1437-wave-4-scale-enterprise]
blocks: []
roadmap: ../../docs/development-roadmap.md
---

# Wave 5 — Platform Vision (Open-Ended)

**Timeframe:** Tháng 12+ (open-ended, iterative).
**Trigger:** Wave 4 exit — HA + enterprise stack GA, ≥5 org, marketplace ecosystem.
**Estimated:** vô định — driven by product-market signals.

⚠️ **Vision-level plan.** Ít chi tiết hơn v1-4 vì assumptions sẽ thay đổi nhiều trong 12 tháng. Coi như north-star, không phải commitment.

## Objective
Chuyển OneMCP từ knowledge + skills platform → **AI-native business orchestration platform**. Autonomous agents, workflow automation, company-wide semantic graph.

## North-Star Metrics (aspirational)
- ≥80% engineering tasks có agent-augmented workflow.
- KB coverage ≥95% recurring incident types.
- Autonomous agents propose ≥10 correct KB updates/tuần (human review).
- ≥5 external integration live (Jira, Confluence, Slack, GitHub, Datadog...).

## Themes (không phải phases cứng)

| # | Theme | Idea | Est. |
|---|---|---|---|
| W5-T1 | [Workflow orchestration](./phase-01-workflow-orchestration.md) — Temporal-like multi-agent workflows AI-augmented | 6-8w |
| W5-T2 | [Business process templates](./phase-02-business-process-templates.md) — onboarding, incident response, code review flows AI-driven | 6w |
| W5-T3 | [Company-wide semantic graph](./phase-03-semantic-graph.md) — unified KB + code + design + tickets, agent-navigable | 12w |
| W5-T4 | [Autonomous agent runtime](./phase-04-autonomous-agents.md) — 24/7 agents monitor codebase/docs, propose updates | 12w |
| W5-T5 | [External integrations](./phase-05-external-integrations.md) — Jira/Linear/Confluence/Slack/GitHub | Ongoing |
| W5-T6 | [AI safety layer](./phase-06-ai-safety.md) — PII redaction pre-embed, hallucination detection, human-in-loop | 8w |

## Guiding Principles for Wave 5

1. **Don't chase hype.** Every feature must solve documented pain from Wave 1-4 usage data, không phải "vì AI agents đang trend".
2. **Human-in-loop bắt buộc** cho autonomous features — không auto-apply changes.
3. **Privacy-first.** Semantic graph không expose sensitive data cross-dept không có approval.
4. **Extensibility over feature completeness.** Cho phép integration platform mở, không code integration cứng.
5. **Deprecate liên tục.** Feature Wave 1-3 không dùng → deprecate, không cargo-cult.

## Decision Framework
Every Wave 5 initiative phải trả lời:
- **Pain proof:** case study cụ thể từ Wave 1-4 chứng minh nhu cầu.
- **Metric target:** đo được sau 3 tháng.
- **Kill criteria:** khi nào biết fail và rollback.

## What NOT to build (anti-vision)

- ❌ AI writes production code không có review.
- ❌ Chatbot general-purpose (Slack đã có).
- ❌ "AI CEO" — decision layer thay human.
- ❌ Content moderation autonomous (risk quá cao).
- ❌ Custom foundation model training (không phải core business).

## Detailed Phase Files
Viết theo từng theme khi có product-market signal cụ thể. Wave 5 sẽ có nhiều micro-plans hơn 1 big plan.

## Unresolved (long-term strategic)
- OneMCP có nên open-source subset không (community-driven marketplace)?
- Business model nếu spin-off SaaS: freemium vs enterprise-only?
- Partnership với Anthropic/OpenAI cho model tier riêng?
- Vertical hoá theo industry (fintech/healthcare/manufacturing) hay horizontal?
- Regulatory positioning (AI Act EU, US executive orders) — cần compliance layer dedicated?
