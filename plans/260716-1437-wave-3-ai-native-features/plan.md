---
title: OneMCP — Wave 3 AI-Native Features
slug: wave-3-ai-native-features
created: 2026-07-16
status: pending
blockedBy: [260716-1437-wave-2-hardening-rollout]
blocks: [260716-1437-wave-4-scale-enterprise]
roadmap: ../../docs/development-roadmap.md
---

# Wave 3 — AI-Native Features

**Timeframe:** Tháng 4-10 (chồng lấp cuối Wave 2).
**Trigger:** Wave 2 exit — ≥3 dept adopt, feedback data collected.
**Estimated:** ~16 tuần / 2 dev.

Blocked bởi Wave 2 — phase files chi tiết viết khi kích hoạt.

## Objective
Chuyển từ passive knowledge store → active AI platform. Giảm 10x friction khi viết KB qua AI-drafting. Xây knowledge graph cross-artifact.

## Success Metrics
- ≥50% KB submit có AI-generated draft (dev chỉ edit + submit).
- Cross-linking rate: ≥30% artifacts có `related_kb[]` populated.
- Duplicate KB rate <5% (đo qua embedding similarity kiểm tra định kỳ).
- Search recall top-3 ≥85% (nếu fine-tune embed).

## Phases (planned)

| # | Phase | Rationale | Est. |
|---|---|---|---|
| W3-P1 | [AI-generated KB draft](./phase-01-ai-kb-draft.md) — auto-draft từ session transcript khi detect resolve pattern | Biggest friction reducer (Tier S) | 3w |
| W3-P2 | [Related KB suggestions](./phase-02-related-kb-suggestions.md) — embedding similarity check khi submit | Prevent dedupe, build graph | 2w |
| W3-P3 | [Cross-artifact graph](./phase-03-cross-artifact-graph.md) — report↔research↔KB linking, portal graph view | Discover connections | 3w |
| W3-P4 | [Prompt/context packs](./phase-04-prompt-context-packs.md) — personas, style guides via MCP resources | Standardize agent context | 2w |
| W3-P5 | [Skill dependency management](./phase-05-skill-dependencies.md) — skill A requires skill B, version resolution | Complex skills khả thi | 2w |
| W3-P6 | [Custom embedding fine-tune](./phase-06-embedding-fine-tune.md) — domain-specific model trên corpus nội bộ | Nếu recall pilot kém | 3w |
| W3-P7 | [Duplicate KB detection](./phase-07-duplicate-detection.md) — similarity threshold warning khi submit | Content hygiene | 1w |

## Priority Ordering
1. **W3-P1** (Tier S) — biggest lever, do first.
2. **W3-P2 + W3-P7** — nối tiếp (share embedding infra).
3. **W3-P6** — chỉ nếu recall < target.
4. **W3-P3, W3-P4, W3-P5** — parallel.

## Technical Considerations
- **Session transcript access:** Cần thoả thuận với Claude Code stop-hook (Wave 2.1) để dump transcript hợp lệ (privacy scrub trước).
- **AI draft cost:** dùng Claude API hoặc local model — cần budget quyết định.
- **Fine-tune embed:** contrastive learning trên positive pairs (query → matched KB) thu từ analytics Wave 2.5.
- **Graph storage:** giữ trong Postgres (recursive CTE) hoặc migrate Neo4j (chỉ nếu >100k edges).

## Decision Gate
- Wave 2 kết thúc, KB volume ≥100 (đủ context cho AI draft)?
- Analytics từ Wave 2.5 đã có query-to-KB match pairs cho fine-tune (nếu chọn P6)?

## Detailed Phase Files
Viết khi decision gate pass.

## Unresolved
- LLM cho AI draft: Claude API vs self-host (llama.cpp)?
- Graph UI complexity đủ giá trị hay đơn giản là "related links" list?
- Ai train + evaluate embedding fine-tune?
