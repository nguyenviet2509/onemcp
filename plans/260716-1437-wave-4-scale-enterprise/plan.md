---
title: OneMCP — Wave 4 Scale & Enterprise
slug: wave-4-scale-enterprise
created: 2026-07-16
status: pending
blockedBy: [260716-1437-wave-3-ai-native-features]
blocks: [260716-1437-wave-5-platform-vision]
roadmap: ../../docs/development-roadmap.md
---

# Wave 4 — Scale + Enterprise

**Timeframe:** Tháng 8-16 (chồng lấp cuối Wave 3).
**Trigger:** Wave 3 exit — KB corpus ≥1000, search hit rate ≥80%, đủ signal justify enterprise investment.
**Estimated:** ~36 tuần / 3-4 dev (team scale up cần thiết).

Blocked bởi Wave 3.

## Objective
Chuẩn bị OneMCP scale toàn công ty + tính năng B2B-grade: HA, sandbox execution, cross-org federation, compliance, mobile.

## Success Metrics
- Uptime ≥99.9% (từ 99.5% v1).
- ≥5 org / dept sử dụng (nếu multi-tenant federation).
- Skill sandbox GA: ≥20 skills chạy code an toàn.
- SIEM integration live, monthly audit report tự động.
- Mobile PWA usage ≥30% daily active.

## Phases (planned)

| # | Phase | Rationale | Est. |
|---|---|---|---|
| W4-P1 | [HA architecture](./phase-01-ha-architecture.md) — PG primary+replica, MinIO distributed, K8s migration | Uptime 99.9%, horizontal scale | 4w |
| W4-P2 | [GPU embedding cluster](./phase-02-gpu-embedding.md) — TEI/vLLM batch + query | Throughput all-company | 2w |
| W4-P3 | [Skill sandbox execution](./phase-03-skill-sandbox.md) — gVisor/Firecracker isolation | Unlock dynamic skills safely | 6w |
| W4-P4 | [Cross-org federation](./phase-04-federation.md) — multi-tenant INET, sharing rules | Multi-company deployment | 4w |
| W4-P5 | [Compliance/audit export](./phase-05-compliance-export.md) — SIEM (Splunk/Elastic), monthly report | Enterprise compliance | 2w |
| W4-P6 | [Data lake/warehouse](./phase-06-data-lake.md) — Airbyte → BigQuery/Snowflake | BI + ML analytics | 3w |
| W4-P7 | [Advanced RBAC (ABAC)](./phase-07-advanced-rbac.md) — attribute-based, custom policy, per-artifact ACL | Fine-grained control | 3w |
| W4-P8 | [Realtime notifications](./phase-08-realtime-notifications.md) — WebSocket + Slack/Teams push | Inbox model | 2w |
| W4-P9 | [Mobile PWA](./phase-09-mobile-pwa.md) — portal PWA + native shell | On-the-go access | 4w |
| W4-P10 | [Skill marketplace](./phase-10-skill-marketplace.md) — external contributions, verification, ratings | Ecosystem | 6w |

## Priority Ordering
Không all-in-one — pick theo demand:

**Track A — Infrastructure hardening (mandatory nếu scale):**
- W4-P1 → W4-P2 → W4-P5

**Track B — Capability expansion (chọn theo product ask):**
- W4-P3 (sandbox) — nếu skill authors đòi execution
- W4-P7 (ABAC) — nếu enterprise customer đòi
- W4-P10 (marketplace) — nếu ecosystem play

**Track C — UX polish (parallel):**
- W4-P8, W4-P9

**Track D — Analytics platform:**
- W4-P6

## Critical Considerations
- **Team scale-up required:** 2 dev không đủ. Cần 3-4 dev + 1 SRE.
- **K8s migration risk:** Docker Compose → K8s là major refactor, plan riêng biệt.
- **Sandbox security:** đây là security-critical, cần external audit trước khi GA.
- **Federation identity:** phức tạp nhất, cần INET SSO federation support.

## Decision Gate
- Company đã commit multi-dept scale (≥5 dept)?
- Có SRE/DevOps team dedicated?
- Budget cho K8s cluster + GPU cluster đã approved?
- Nếu chưa → hoãn Wave 4, tập trung Wave 3 content generation.

## Detailed Phase Files
Viết khi decision gate pass. Track A ưu tiên viết trước.

## Unresolved
- On-prem K8s (Rancher/OKD) vs managed (GKE/AKS)?
- Sandbox tech: gVisor vs Firecracker vs Wasm runtime?
- Federation: OpenID Connect Federation spec vs custom protocol?
- Data lake destination: on-prem ClickHouse vs cloud warehouse (violate data locality)?
