# OneMCP — Development Roadmap

**Last updated:** 2026-07-16
**Owner:** trihd@inet.vn
**Current phase:** v1 planning (see [plan](../plans/260716-1112-onemcp-department-mcp-server/plan.md))

---

## Vision

Từ MCP server nội bộ phòng Kỹ thuật → nền tảng knowledge + AI skills orchestration toàn công ty.
Tối ưu cho **bug-trace KB reuse** ở v1, mở rộng dần sang multi-agent workflow + autonomous agents.

---

## Timeline overview

| Wave | Timeframe | Focus | Status |
|---|---|---|---|
| v1 | Tháng 0–3 | Foundation + Kỹ thuật pilot | In planning |
| Wave 2 | Tháng 3–6 | Hardening + multi-dept rollout | Not started |
| Wave 3 | Tháng 4–10 | AI-native features | Not started |
| Wave 4 | Tháng 8–16 | Scale + enterprise | Not started |
| Wave 5 | Tháng 12+ | Platform vision | Not started |

Timeline chồng lấp có chủ đích — waves chạy song song khi độc lập.

---

## v1 — Foundation (10 tuần, 2 dev)

Reference: [plans/260716-1112-onemcp-department-mcp-server](../plans/260716-1112-onemcp-department-mcp-server/plan.md)

- P1 Foundation (auth, RBAC, audit, portal skeleton) — 2w
- P2 Skills Registry (GitLab + MCP list/load) — 2w
- P3 Artifacts Core (CRUD + review + attachments) — 2w
- P4 Search (FTS + semantic) — 1.5w
- P5 Templates & Session Enforcement — 1w
- P6 Hardening (monitoring, backup, load test) — 1.5w

**Exit criteria:** Bug-trace KB reuse hoạt động end-to-end, ≥10 KB published trong pilot, top-3 recall cho error message query.

---

## Wave 2 — Hardening + Rollout (~9 tuần)

Mục tiêu: khắc phục pain từ pilot, expand sang 2-3 dept.

| # | Item | Rationale | Effort |
|---|---|---|---|
| 2.1 | **Client-side hard enforcement** — Claude Code stop-hook script chạy khi end session, verify submit_artifact hoặc skip_artifact. | Prompt-only compliance ~80%, không đủ đảm bảo ROI. | 1w |
| 2.2 | **Multi-dept rollout** — mở Support, DevOps, PM. Cross-dept KB request/approval flow. | Justify đầu tư v1 qua nhân rộng. | 2w |
| 2.3 | **Bug pattern detection** — agent detect session "vừa fix bug" (git `fix:`, ck:debug usage) → nudge KB submit mạnh hơn. | Tăng KB coverage cho bug-fix use case. | 1w |
| 2.4 | **KB feedback loop** — thumbs up/down, "tiết kiệm bao nhiêu giờ" survey, author reputation. | Data-driven quality improvement. | 2w |
| 2.5 | **Search analytics** — dashboard query popular, zero-result queries → maintainer biết KB gap. | Content strategy driven by data. | 1w |
| 2.6 | **Rate limits & quotas** — per-user, per-PAT, per-dept. | Prevent abuse khi scale. | 1w |
| 2.7 | **Admin ops** — bulk role assign, dept clone template. | UX cho admin khi multi-dept. | 1w |

**Exit criteria:** ≥3 dept adopt, ≥95% session compliance, feedback data collected.

---

## Wave 3 — AI-Native Features (~16 tuần)

Mục tiêu: từ passive storage → active knowledge platform.

| # | Item | Rationale | Effort |
|---|---|---|---|
| 3.1 | **AI-generated KB draft** — auto-draft từ session transcript khi detect resolve pattern, dev chỉ review + edit + submit. | Biggest friction reducer, 10x KB volume. | 3w |
| 3.2 | **Related KB suggestions** — khi submit, suggest existing similar KB (dedupe + link). | Prevent duplicates, build knowledge graph. | 2w |
| 3.3 | **Cross-artifact graph** — report ↔ research ↔ KB linking, portal render graph. | Discover connections. | 3w |
| 3.4 | **Prompt/context packs** — beyond skills: personas, style guides, project briefs qua MCP resources. | Standardize agent context. | 2w |
| 3.5 | **Skill dependency management** — skill A require skill B, version resolution. | Complex skills khả thi. | 2w |
| 3.6 | **Custom embedding fine-tune** — domain-specific model trên corpus nội bộ. | Recall pilot cần cải thiện. | 3w |
| 3.7 | **Duplicate KB detection** — embedding similarity check khi submit → warn dup. | Content hygiene. | 1w |

**Exit criteria:** ≥50% KB có AI draft, cross-linking > 30% artifacts, duplicate rate <5%.

---

## Wave 4 — Scale + Enterprise (~36 tuần)

Mục tiêu: chuẩn bị scale toàn công ty + tính năng B2B-grade.

| # | Item | Rationale | Effort |
|---|---|---|---|
| 4.1 | **HA architecture** — PG primary+replica, MinIO distributed, backend horizontal + K8s migration. | Uptime >99.9%, scale. | 4w |
| 4.2 | **GPU embedding cluster** — TEI/vLLM batch + query. | Throughput cho all-company scale. | 2w |
| 4.3 | **Skill sandbox execution** — gVisor/Firecracker isolation cho dynamic skills. | Unlock skill code execution safely. | 6w |
| 4.4 | **Cross-org federation** — multi-tenant INET, sharing rules giữa org. | Multi-company deployments. | 4w |
| 4.5 | **Compliance/audit export** — SIEM integration (Splunk/Elastic), monthly audit report. | Enterprise compliance. | 2w |
| 4.6 | **Data lake / warehouse** — Airbyte → BigQuery/Snowflake cho BI. | Analytics + ML. | 3w |
| 4.7 | **Advanced RBAC** — ABAC, custom policy, per-artifact ACL. | Fine-grained control. | 3w |
| 4.8 | **Realtime notifications** — WebSocket + push (Slack/Teams). | Inbox model. | 2w |
| 4.9 | **Mobile PWA** — portal PWA + native shell. | On-the-go access. | 4w |
| 4.10 | **Skill marketplace** — external contributions, verification pipeline, ratings. | Ecosystem. | 6w |

**Exit criteria:** ≥5 org, 99.9% uptime, sandbox skills GA.

---

## Wave 5 — Platform Vision (12+ tháng, open-ended)

Mục tiêu: OneMCP thành orchestration platform, không chỉ knowledge base.

| # | Item | Notes |
|---|---|---|
| 5.1 | **Workflow orchestration** — Temporal-like multi-agent workflows AI-augmented. | 6-8w |
| 5.2 | **Business process templates** — onboarding, incident response, code review flows. | 6w |
| 5.3 | **Company-wide semantic graph** — unified KB + code + design + tickets. | 12w |
| 5.4 | **Autonomous agent runtime** — 24/7 agents monitor + propose updates. | 12w |
| 5.5 | **External integrations** — Jira/Linear, Confluence migration, Slack. | Ongoing |
| 5.6 | **AI safety layer** — PII redaction, hallucination detection. | 8w |

---

## Prioritization Framework

Ranking dựa trên **ROI × urgency**.

### Tier S — must-do sau v1
1. **Client-side hard enforcement** (2.1) — không có → compliance fail → ROI use case fail.
2. **Multi-dept rollout** (2.2) — justify đầu tư v1.
3. **AI-generated KB draft** (3.1) — biggest friction reducer.

### Tier A — should-do
4. **KB feedback loop + search analytics** (2.4, 2.5) — data-driven.
5. **HA + GPU** (4.1, 4.2) — chỉ khi thực scale.
6. **Skill sandbox** (4.3) — mở khả năng skill động.

### Tier B — nice-to-have
7. **Cross-artifact graph** (3.3).
8. **Federation, mobile, marketplace** (4.4, 4.9, 4.10) — future vision.

### Tier C — chỉ khi có yêu cầu
9. **Workflow orchestration, autonomous agents** (Wave 5) — verify demand.

---

## Decision Gates

**End of v1 pilot (tháng 3):**
- ≥3 case documented Dev B reuse KB tiết kiệm >1h → tiếp Wave 2.
- <10 KB submit / 30 ngày → adoption problem → Wave 2 ưu tiên enforcement + AI-drafting.
- Search recall test <70% → search quality issue → Wave 3 ưu tiên fine-tune embed.

**End of Wave 2 (tháng 6):**
- ≥3 dept adopt → tiếp Wave 3.
- 1 dept adopt → product-market fit issue → pause big investment, iterate.

**End of Wave 3 (tháng 12):**
- KB corpus ≥1000, search hit rate ≥80% → Wave 4 scale.
- Không đạt → focus content generation, hoãn scale.

---

## Anti-Roadmap — điều KHÔNG làm dù hấp dẫn

- ❌ **Fine-tune LLM riêng** — cost cao, ROI thấp. Embedding + RAG đủ.
- ❌ **Blockchain audit trail** — buzzword. Append-only Postgres đủ compliance.
- ❌ **Multi-cloud portable** — on-prem requirement.
- ❌ **Microservices split** — monolith modular đúng cho scale này.
- ❌ **Vector DB riêng (Pinecone/Weaviate)** — pgvector đủ đến ~1M vectors.
- ❌ **GraphQL** — REST + MCP đủ. Không thêm query lang mới.

---

## Bottom line

Sau v1, focus 3 thứ theo thứ tự:
1. **Hard enforce KB submission** — bảo vệ ROI use case chính.
2. **AI-draft KB** — giảm friction lớn nhất.
3. **Multi-dept expansion** — justify investment.

Waves sau chỉ meaningful nếu 3 điểm trên hoạt động.

## Unresolved Questions
- Sau v1 team dev có tiếp tục 2 người hay scale up?
- Budget cho GPU (Wave 3.6 hoặc Wave 4.2) — có sẵn hay cần approval riêng?
- Multi-dept rollout: mở dept nào trước (Support / DevOps / PM)?
- Ai là product owner cho waves sau v1?
