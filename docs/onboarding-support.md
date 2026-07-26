# OneMCP — Onboarding Support Team

Tài liệu tiếng Việt cho Support team. Đọc trong 5 phút, làm được ngay.

---

## OneMCP là gì (dành cho Support)

OneMCP = Knowledge Base trung tâm cho toàn team. Support dùng để:
- Tra nhanh FAQ + ticket playbook khi xử lý ticket khách
- Lưu câu trả lời chuẩn để cả team dùng chung (không ai phải reinvent lại)
- OpenWebUI bot search KB tự động khi hỏi câu hỏi support

Dữ liệu Support nằm trong space:
- **support-faq** — FAQ chuẩn + ticket playbook

---

## Submit FAQ / Ticket Playbook mới

**Khi nào submit?** Khi xử lý ticket mà phải research nhiều → viết lại thành FAQ/playbook để lần sau dùng lại.

**Submit FAQ:**
1. Mở [/artifacts/new?template_key=faq](/artifacts/new?template_key=faq)
2. Điền bắt buộc: **Câu hỏi khách hàng**, **Câu trả lời chuẩn**
3. Tuỳ chọn: Nhóm (billing/technical/account), Câu hỏi tương tự, Khi nào escalate
4. Submit → `pending` → reviewer approve → `published` vào space `support-faq`

**Submit Ticket Playbook:**
1. Mở [/artifacts/new?template_key=ticket_playbook](/artifacts/new?template_key=ticket_playbook)
2. Điền bắt buộc: **Loại ticket**, **Bước chẩn đoán**, **Các phương án xử lý**
3. Tuỳ chọn: Mức độ, SLA cam kết, Ma trận escalate, Mẫu communication khách
4. Submit → pending → published

<!-- TODO: screenshot portal /artifacts/new với template FAQ selected -->

**Tips:**
- Tag: tên-tính-năng, `billing`, `login`, `api` — search nhanh theo product area
- Trường **Khi nào escalate**: ghi rõ điều kiện → Support L1 tự quyết không cần hỏi lead
- Mẫu communication khách: copy-paste ready, tiết kiệm 2-3 phút/ticket

---

## Tra FAQ khi trả ticket

**Cách 1 — Search portal (nhanh nhất):**
1. Mở [/search?space=support-faq](/search?space=support-faq)
2. Space filter đã set sẵn `support-faq`
3. Paste keywords từ ticket khách: "không đăng nhập được", "lỗi thanh toán", "reset mật khẩu"
4. Click FAQ → copy **Câu trả lời chuẩn** → paste vào ticket reply

<!-- TODO: screenshot search với space filter support-faq và kết quả FAQ -->

**Cách 2 — Lọc theo nhóm:**
1. [/artifacts?space=support-faq&tag=billing](/artifacts?space=support-faq&tag=billing) — tất cả FAQ billing
2. [/artifacts?space=support-faq&tag=login](/artifacts?space=support-faq&tag=login) — tất cả FAQ login

**Cách 3 — OpenWebUI bot:**
```
# Trong chat OpenWebUI:
"Khách báo không đăng nhập được, lỗi 'session expired'"
# Bot tự gọi: onemcp_search("session expired đăng nhập", space="support-faq")
# Trả về FAQ + câu trả lời chuẩn
```

<!-- TODO: screenshot OpenWebUI chat với kết quả FAQ support -->

---

## Dùng Ticket Playbook

Ticket playbook = cây quyết định cho loại ticket cụ thể. Nhanh hơn FAQ khi ticket phức tạp.

**Tra playbook:**
1. [/search?q=ticket+playbook+billing&space=support-faq](/search?q=ticket+playbook+billing&space=support-faq)
2. Hoặc [/artifacts?space=support-faq&template_key=ticket_playbook](/artifacts?space=support-faq&template_key=ticket_playbook)

**Dùng playbook:**
1. Đọc **Bước chẩn đoán** → xác định nguyên nhân
2. Chọn **Phương án xử lý** phù hợp với triệu chứng
3. Nếu cần escalate → xem **Ma trận escalate** trong playbook
4. Copy **Mẫu communication khách** → chỉnh tên khách → send

<!-- TODO: screenshot artifact ticket playbook đã published -->

→ Artifact mẫu: [[MẪU] Xử lý ticket P1 khách hàng](/artifacts?q=ticket+p1)

---

## Dùng OpenWebUI bot

Tool `onemcp_search` hỗ trợ param `space` từ Phase 4 v1.5:
```
# Search trong support-faq:
onemcp_search("lỗi đăng nhập session expired", space="support-faq")

# Search toàn bộ KB (không giới hạn space):
onemcp_search("billing refund quy trình")
```

Liên hệ admin để join workspace phù hợp trên OpenWebUI.

---

## Escalation khi không có playbook

1. Search thêm với từ khóa khác — thử cả EN lẫn VN
2. Nếu vẫn không tìm được → tạo incident ticket, tag `escalation`
3. Ping Ops oncall nếu liên quan hệ thống
4. Sau khi resolve → **viết FAQ mới** để lần sau tìm được

---

## Onboarding checklist

- [ ] Đăng nhập portal, vào [/onboarding/support](/onboarding/support)
- [ ] Tìm 1 FAQ trong space `support-faq`
- [ ] Search thử 1 keyword từ ticket thật gần nhất
- [ ] Tạo 1 FAQ mới từ ticket đã xử lý (status pending)
- [ ] Lưu saved search cho từ khóa hay dùng

---

## Liên hệ

- Support lead: TODO(support-lead) — điền tên + email
- Portal: [/onboarding/support](/onboarding/support)
- Docs Ops (nếu cần escalate): [docs/onboarding-ops.md](onboarding-ops.md)
