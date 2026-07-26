# OneMCP — Onboarding Ops Team

Tài liệu tiếng Việt cho Ops team. Đọc trong 5 phút, làm được ngay.

---

## OneMCP là gì (dành cho Ops)

OneMCP = Knowledge Base trung tâm cho toàn team. Ops dùng để:
- Lưu SOP, runbook, escalation matrix vào 1 nơi tìm được
- Tra cứu nhanh khi oncall (search VN + EN, không cần nhớ tên file)
- OpenWebUI bot tự động search KB khi hỏi câu hỏi ops

Dữ liệu Ops nằm trong 2 space:
- **ops-runbook** — SOP, quy trình vận hành
- **ops-oncall** — oncall handoff, escalation matrix, alert playbook

---

## Submit runbook / SOP

**Cách 1 — Portal (khuyến nghị):**
1. Mở [/artifacts/new?template_key=sop](/artifacts/new?template_key=sop)
2. Template **SOP - Quy trình vận hành** đã chọn sẵn
3. Điền bắt buộc: **Đối tượng áp dụng**, **Mục đích**, **Các bước thực hiện**
4. Tuỳ chọn: Điều kiện tiên quyết, SOP liên quan, Người duy trì
5. Submit → trạng thái `pending` → reviewer approve → `published`
6. Sau khi published: artifact tự vào space `ops-runbook`

**Cách 2 — OpenWebUI (paste từ chat):**
1. Draft SOP trong chat OpenWebUI
2. Bot submit qua `onemcp_submit` → status `pending`, review sau

<!-- TODO: screenshot portal /artifacts/new với template SOP selected -->

**Tips:**
- Tag: `sop`, tên-service, `oncall` — giúp search chính xác hơn
- Trường **Người duy trì**: điền tên + email → biết ai update khi SOP lỗi thời
- Review định kỳ 3 tháng/lần — ghi ngày review vào phần **SOP liên quan**

---

## Tra cứu khi oncall

**Cách nhanh nhất — Search portal:**
1. Mở [/search?space=ops-runbook](/search?space=ops-runbook)
2. Space filter đã set sẵn `ops-runbook`
3. Gõ triệu chứng: "nginx 502", "disk full /var", "postgres OOM"
4. Click artifact → đọc **Các bước thực hiện** + **SOP liên quan**

<!-- TODO: screenshot search với space filter ops-runbook -->

**Cách 2 — Saved searches:**
1. Chạy search thường dùng (VD: "oncall handoff", "escalation")
2. Click **Save search** → đặt tên → xuất hiện trong sidebar
3. Lần sau oncall: click 1 cái, không cần gõ lại

**Cách 3 — OpenWebUI bot:**
```
# Trong chat OpenWebUI, hỏi tự nhiên:
"nginx đang trả 502, làm gì?"
# Bot tự gọi: onemcp_search("nginx 502", space="ops-runbook")
# Trả về snippet từ runbook phù hợp nhất
```

<!-- TODO: screenshot OpenWebUI chat với kết quả search ops-runbook -->

---

## Escalation matrix

Escalation matrix nằm trong space `ops-oncall`.

**Tra:**
1. [/search?q=escalation+matrix&space=ops-oncall](/search?q=escalation+matrix&space=ops-oncall)
2. Hoặc filter [/artifacts?space=ops-oncall&tag=escalation](/artifacts?space=ops-oncall&tag=escalation)

**Bảng severity chuẩn (xem chi tiết trong artifact):**

| Severity | Điều kiện | Escalate tới | Thời gian phản hồi |
|---|---|---|---|
| SEV1 | Outage toàn hệ thống | Ops Lead + CTO | 5 phút |
| SEV2 | 1 service degraded | Ops oncall | 15 phút |
| SEV3 | Lỗi nhỏ, không ảnh hưởng SLA | Ops next shift | 4 giờ |

→ Artifact mẫu: [[MẪU] Escalation matrix theo mức severity](/artifacts?q=escalation+matrix)

<!-- TODO: screenshot artifact escalation matrix đã published -->

---

## Dùng OpenWebUI bot (Ops workspace)

Admin sẽ add vào workspace **Ops-Helper** — scoped sẵn Ops spaces.

Không cần chỉ định space nếu đã trong Ops workspace. Nếu dùng workspace chung:
```
onemcp_search("oncall handoff quy trình", space="ops-oncall")
onemcp_search("nginx timeout runbook", space="ops-runbook")
```

Tool `onemcp_search` hỗ trợ param `space` từ Phase 4 v1.5.

---

## Onboarding checklist

- [ ] Đăng nhập portal, vào [/onboarding/ops](/onboarding/ops)
- [ ] Tìm runbook bất kỳ trong space `ops-runbook`
- [ ] Lưu 1 saved search thường dùng
- [ ] Tạo 1 artifact SOP mẫu (status pending)
- [ ] Join OpenWebUI workspace Ops-Helper (liên hệ admin)

---

## Liên hệ

- Ops lead: TODO(ops-lead) — điền tên + email
- Portal: [/onboarding/ops](/onboarding/ops)
- Docs kỹ thuật: [docs/system-architecture.md](system-architecture.md)
