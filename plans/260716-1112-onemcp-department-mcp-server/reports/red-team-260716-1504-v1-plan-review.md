# Red-Team Review — v1 Plan (260716-1112-onemcp-department-mcp-server)

**Date:** 2026-07-16
**Reviewers (personas):** Security Engineer, SRE/Ops, Senior Architect, Product Manager, Pilot Developer
**Verdict:** ⚠️ Plan chấp nhận được cho pilot, nhưng **5 findings CRITICAL + 8 HIGH** cần địa chỉ trước khi cook.

---

## 🔴 CRITICAL findings

### C1. Trust header là honeypot cho supply chain risk
**Persona:** Security Engineer
**Attack:** Bất kỳ ai trong CIDR (bao gồm dev laptop compromised) đều có thể spoof `X-Onemcp-User: dept-admin` → submit skill malicious → maintainer approve tin tưởng "admin submit" → skill có `permissions: [execute]` chạy trong session tương lai.

**Concrete exploit:**
1. Attacker vào VPN (phishing dev credentials).
2. Curl backend với `X-Onemcp-User: alice` (biết alice = maintainer từ portal profile page).
3. Approve chính MR skill mình vừa push.
4. Skill được publish → chạy trong sessions của toàn team.

**Impact:** RCE nội bộ qua skill.

**Mitigation cần thêm P1:**
- Skills load bởi MCP server phải **read-only static content** (SKILL.md, resources). Không có `execute` permission trong manifest v1 → confirm rõ trong phase-02.
- Maintainer approve phải có **out-of-band confirm** (Slack notify + link) → dùng để mitigate spoof.
- Rate limit approve action (max 5/hour per user) để làm hard automated abuse.
- Portal profile page KHÔNG expose danh sách maintainer publicly.

---

### C2. Skills sync worker chạy git fetch từ internet-facing GitLab với credentials
**Persona:** Security Engineer
**Attack:** GitLab webhook có HMAC verify (tốt), nhưng backend còn phải **git fetch** repo qua HTTPS/SSH → cần credentials. Nếu credentials leak → attacker clone tất cả skills repos.

**Vấn đề trong plan:**
- Phase-02 không nêu rõ backend authenticate với GitLab như thế nào để clone/fetch.
- Nếu dùng PAT trong env → PAT có scope quá rộng (read_repository toàn project) = blast radius lớn.

**Mitigation:**
- Dùng **GitLab Deploy Token** riêng cho mỗi skills repo (read_repository scope hẹp).
- Store credentials trong Docker secret hoặc external secret manager, không phải plain env.
- Rotate credentials sau security review P6.

---

### C3. IP CIDR + không auth = **portal admin routes exposed nội bộ**
**Persona:** Security Engineer + SRE
**Attack:**
- `USER_ALLOW_CIDR=10.0.0.0/8` mở cho toàn LAN.
- Portal có `/admin/*` (templates, audit viewer, users).
- Kẻ nội bộ (intern, contractor) đều có thể sửa template schema, xóa user, xem audit của người khác.

**Vấn đề:** Plan có `ADMIN_ALLOW_CIDR` (hẹp hơn) — nhưng không rõ **middleware nào enforce** khác biệt user vs admin routes.

**Mitigation:**
- Explicit middleware chain: admin routes phải qua `AdminCidrGuard` (strict `ADMIN_ALLOW_CIDR`), user routes qua `UserCidrGuard`.
- Trust header role check: user tự khai `admin` từ IP không phải `ADMIN_ALLOW_CIDR` → reject 403 + audit event `impersonation_attempt`.
- Portal `/admin/*` guard duplicate check ở Next.js middleware (defense in depth).

---

### C4. Không có "kill switch" nếu security event xảy ra trong pilot
**Persona:** SRE
**Vấn đề:** Auth defer → nếu phát hiện breach (trust header abused), làm gì? Không có mechanism nào trong plan để lock down nhanh.

**Mitigation:**
- Env flag `EMERGENCY_LOCKDOWN=true` — mọi request trả 503 trừ /health.
- Runbook trong P6: emergency lockdown procedure, 30 phút cho ops.
- Admin action "revoke user" mặc dù không auth thật — set `users.status='disabled'`, trust middleware reject.

---

### C5. Session-wrapup skill là single point of failure cho ROI use case
**Persona:** Product Manager
**Attack:** Nếu skill này bị disable/skip/không adopt → **primary use case (bug-trace KB reuse) fail hoàn toàn**. Toàn bộ ROI plan dựa vào 1 skill mềm.

**Concrete failure mode:**
- Dev disable skill trong CLAUDE.md của mình.
- Skill không load được (git mirror lỗi) → session không nhắc submit.
- Agent gọi `skip_artifact("bận, mai viết")` 90% thời gian.

**Mitigation cần thêm:**
- Metric alert: nếu skip ratio >70% trong 3 ngày liên tiếp → ops notify.
- P5 phải có e2e test: skill fail-load → agent behavior fallback (không silent skip).
- Consider client-side hook cho v1 luôn (không đợi Wave 2) — chi phí tăng ~3-5 ngày nhưng bảo vệ ROI.
- **Đề xuất mạnh:** Move Wave 2.1 (client-side hard enforcement) → thành **P6.5 của v1**.

---

## 🟠 HIGH findings

### H1. Ubuntu 24.04 + Docker Compose stack không battle-tested trên VPS 8vCPU/32GB
**Persona:** SRE
Ubuntu 24.04 mới, một số image có thể chưa stable. Không có staging environment trong plan blockers.

**Mitigation:**
- Test compose stack full trên VM Ubuntu 24.04 local trước khi deploy VPS.
- Nếu package repo issue → downgrade 22.04 LTS (đề xuất backup).
- Provision staging VPS song song production (thêm cost nhưng đáng).

### H2. Postgres pgvector ivfflat index lists=100 sai với data volume nhỏ
**Persona:** Senior Architect
Phase-04 nói `lists=100` — nhưng với <1000 artifacts, ivfflat cho recall kém (Postgres pgvector docs khuyến nghị lists ≈ rows/1000, hoặc dùng HNSW).

**Mitigation:**
- V1 exact search (`<->` không index) đến khi >1000 rows.
- Sau đó dùng **HNSW** thay vì ivfflat (pgvector 0.5+) — recall tốt hơn ở low data.
- Update phase-04 rõ ngưỡng switch.

### H3. ONNX Runtime CPU cho e5-small tunning issues chưa được điều tra
**Persona:** Senior Architect
Phase-04 nói `~200-500ms/doc` nhưng chưa có benchmark. Có thể chậm hơn nhiều nếu:
- ONNX không dùng quantized model.
- Threading không config đúng (INTRA/INTER threads).
- Sentence-transformers preprocessing overhead cao.

**Mitigation:**
- Benchmark thực tế trên VPS spec trước khi commit → nếu quá chậm, dùng `@xenova/transformers` (đã quantize) hoặc `fastembed`.
- Nếu >1s/doc → cân nhắc lên GPU sớm hoặc external API tạm cho pilot.

### H4. BullMQ + Redis single-node = single point of failure
**Persona:** SRE
Redis crash → toàn bộ embedding + skill sync queue mất → data không được indexed. Không có persistence config trong plan.

**Mitigation:**
- Redis AOF persistence bật (`appendonly yes`, `appendfsync everysec`).
- Queue idempotent: worker phải xử lý được dup job (unique job ID theo `artifact_version_id`).
- Backup Redis dump trong daily backup.

### H5. Không có DB migration test / rollback strategy
**Persona:** SRE
Plan có nhiều migrations (init, skills, artifacts, search-indexes, templates). Không có:
- Migration rollback test.
- Data preservation test khi upgrade schema.
- Ngưỡng response nếu migration fail giữa production.

**Mitigation:**
- Mỗi migration phải có `.down()` implementation.
- CI test migrate up → migrate down → migrate up (round-trip).
- P1 thêm todo: migration rollback runbook.

### H6. Portal Next.js SSR + shadcn build size chưa được đo
**Persona:** SRE / Frontend engineer
Next.js 15 + shadcn có thể ~200MB image, cold start slow trên 8vCPU shared với backend + workers + PG + MinIO.

**Mitigation:**
- Portal build → static export where possible (admin pages có thể static + client fetch).
- Standalone Next.js output (`output: 'standalone'`) → image ~100MB.
- Memory limit trong compose (portal max 1GB).

### H7. GitLab webhook không có retry semantics rõ
**Persona:** Senior Architect
Phase-02 nói "webhook idempotent" nhưng không nêu:
- GitLab webhook có retry chính sách gì?
- Nếu backend down → webhook lost?

**Mitigation:**
- GitLab webhook có "Test webhook" + delivery history — dùng để manual retry.
- Backup: cron `resync-skills.sh` chạy mỗi 15 phút compare `skill_versions` với git log.
- Alert nếu skill_version lag > 30 phút sau merge.

### H8. Timeline 9 tuần cho 2 dev là aggressive
**Persona:** Product Manager
Kinh nghiệm: NestJS + Next.js + ONNX embedding + MinIO + monitoring stack cho 2 dev fullstack trong 9 tuần = **very optimistic**. Rủi ro slip 30-50%.

**Mitigation:**
- Buffer 2 tuần cho unforeseen (13 tuần total realistic).
- Cắt scope P6 xuống bare-minimum ops (monitoring có thể defer, chỉ backup + health check mandatory).
- Hoặc scale team lên 3 dev cho P4 (search) + P6 (hardening).

---

## 🟡 MEDIUM findings

### M1. "Identify as" dropdown UX không friction-free
Dev phải nhập username lần đầu. Nếu quên → identity spoofing accidental (anyone).
**Fix:** localStorage default = OS username qua browser API nếu có (khả năng thấp), hoặc fetch từ VPN certificate CN nếu có.

### M2. Portal không có dark mode
Dev developer prefer dark mode. Nếu portal light-only → adoption friction.
**Fix:** shadcn hỗ trợ theme toggle sẵn, thêm 30 phút.

### M3. Backup encryption at rest chưa nêu key management
Phase-06 nêu SSE-S3 nhưng MinIO SSE-S3 dùng key nội bộ MinIO — nếu MinIO compromise, key compromise.
**Fix:** SSE-KMS với key store external (Vault) — nhưng out of scope pilot. Chấp nhận và document risk.

### M4. Load test 50 concurrent chưa realistic cho all-company scale sau này
V1 chỉ Kỹ thuật ~30 dev, 50 concurrent đủ. Nhưng khi Wave 2 mở 3 dept → có thể 150+ concurrent.
**Fix:** P6 load test theo 3 tier: 50, 100, 200 để đánh giá capacity headroom.

### M5. Không có data retention policy cho artifacts
Users có xóa được KB cũ không? GDPR-like concerns?
**Fix:** Soft delete implemented in P3 (đã có), nhưng cần chính sách rõ: giữ vĩnh viễn vs auto-purge sau N năm. Document trong docs/deployment-guide.md.

### M6. Skills manifest schema versioning chưa design
Phase-02 nêu "schema versioning field" nhưng chưa nói behavior khi backend không support version manifest mới.
**Fix:** Explicit: manifest.yaml `manifest_version: 1`. Backend reject nếu > MAX_SUPPORTED.

### M7. Session-wrapup skill cần có mechanism nhận biết "session end"
Claude Code không có hook "session end" chính thức trong stable. Skill instruction chỉ soft prompt.
**Fix:** Document rõ trong P5: "session end" là khi user close CLI hoặc explicit /wrap-up command. Không assume hook.

### M8. Nginx rate limit config cần cân nhắc
Rate limit per IP hợp lý cho web browser, nhưng CI/CD agents có thể spam từ 1 IP.
**Fix:** Rate limit per (IP + username) từ trust header, không chỉ IP.

---

## 🟢 LOW findings

### L1. Docs directory sẽ có 10+ files sau v1 — overwhelm
Chỉ cần 5-6 core docs. Sáp nhập ops-runbook + backup-restore-runbook.

### L2. Skills authoring guide chưa có example
P2 cần include 1 skill example (VD `session-wrapup` chính là example) trong docs.

### L3. Portal i18n
Pilot Kỹ thuật Việt Nam — tiếng Việt hay Anh? Nếu mixed → confusion. Chọn 1 và stick.

### L4. Log format standardization
Pino + Nginx access log + Postgres log — 3 format khác nhau. Ops parse khó.
**Fix:** Structured JSON logs cho tất cả, ship qua Loki (Wave 4).

### L5. Time zone handling
Nếu multi-dept sau này có branch nước ngoài → timestamps UTC hay local? Document.

---

## Tổng hợp

| Severity | Count | Address in |
|---|---|---|
| Critical | 5 | Trước cook P1 (blocker) |
| High | 8 | Trong P1-P6 (integrate vào phase files) |
| Medium | 8 | Backlog cho retrospective + Wave 2 |
| Low | 5 | Tolerate cho pilot |

**Recommend action:**
1. **Địa chỉ 5 critical findings bằng đề xuất mitigation** — update phase files hoặc add explicit todo.
2. **Cân nhắc bổ sung "P6.5 Client-side enforcement"** (chi phí +3-5 ngày) để bảo vệ ROI.
3. **Provision staging VPS + benchmark ONNX** trước khi commit final timeline.
4. **Timeline realistic: 12-13 tuần** thay vì 9 (buffer 30%).

## Unresolved
- Có accept trade-off timeline 12 tuần thay 9 để address critical findings không?
- Client-side enforcement move từ Wave 2 xuống v1 (P6.5) đồng ý không?
- Ubuntu 24.04 → confirm hay downgrade 22.04?
- Staging VPS budget approved không?
