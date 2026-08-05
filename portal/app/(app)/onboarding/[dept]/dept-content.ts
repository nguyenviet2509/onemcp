// dept-content.ts — per-department onboarding content map.
// Imported by [dept]/page.tsx. Add new depts here; page auto-renders.
// Phase 4 v1.5: ops + support content replaced with real Vietnamese use cases.
// TODO(video-url): replace VIDEO_PLACEHOLDER comments with actual embed links when available.

export interface DeptContent {
  label: string;
  markdown: string;
}

// ---------------------------------------------------------------------------
// Tech / Engineering (unchanged from Phase 3)
// ---------------------------------------------------------------------------
const tech: DeptContent = {
  label: 'Engineering / Tech',
  markdown: [
    '## Chào mừng team Engineering',
    '',
    'OneMCP là knowledge hub trung tâm cho runbooks, KB articles, incident guides, và on-call procedures.',
    '',
    '### Quick links',
    '',
    '- [KB articles](/artifacts?template_key=kb) — tìm và duyệt tất cả KB',
    '- [Runbooks](/artifacts?template_key=runbook) — runbook từng bước cho operations',
    '- [Incident reports](/artifacts?template_key=report) — post-mortem và incident records',
    '',
    '### Getting started',
    '',
    '1. **Duyệt artifacts** — vào [Artifacts](/artifacts), filter theo template hoặc tag.',
    '2. **Search** — dùng [Search](/search) với mode **Hybrid** cho kết quả tốt nhất.',
    '3. **Tạo runbook** — click **New artifact**, chọn template *Runbook*, điền các bước.',
    '4. **Lưu search** — chạy search, click **Save search** để ghim vào sidebar.',
    '',
    '### Recommended templates',
    '',
    '| Template | Use case |',
    '|---|---|',
    '| runbook | Operational step-by-step guides |',
    '| kb | Knowledge base articles, how-tos |',
    '| report | Post-mortem và RCA |',
    '| postmortem | Chi tiết post-mortem với timeline |',
    '',
    '> **Tip:** Tag artifact với service name (nginx, postgres, k8s) để teammate filter nhanh.',
  ].join('\n'),
};

// ---------------------------------------------------------------------------
// Operations — Phase 4 real content
// ---------------------------------------------------------------------------
const ops: DeptContent = {
  label: 'Operations',
  markdown: [
    '## Chào mừng team Ops',
    '',
    'OneMCP lưu toàn bộ SOP, runbook oncall, và escalation matrix của team Ops trong một nơi có thể search được.',
    '',
    '<!-- TODO(video-url): embed demo video khi có link -->',
    '<!-- Video demo: [xem hướng dẫn 5 phút](#) -->',
    '',
    '### 3 use case chính',
    '',
    '#### 1. Submit runbook / SOP mới',
    '1. Vào [New artifact](/artifacts/new?template_key=sop) — template SOP đã được chọn sẵn.',
    '2. Điền các trường: **Đối tượng áp dụng**, **Mục đích**, **Các bước thực hiện**.',
    '3. Submit → trạng thái *pending* → reviewer approve → *published*.',
    '4. Artifact tự động vào space `ops-runbook` sau khi published.',
    '',
    '#### 2. Tra runbook lúc oncall',
    '1. Vào [Search](/search?space=ops-runbook) — đã filter sẵn space `ops-runbook`.',
    '2. Gõ tên service hoặc triệu chứng (VD: "nginx 502", "disk full", "oncall handoff").',
    '3. Click artifact → đọc phần **Các bước thực hiện** + **SOP liên quan**.',
    '4. Hoặc dùng OpenWebUI bot: gõ câu hỏi → bot gọi `onemcp_search(space="ops-runbook")`.',
    '',
    '#### 3. Escalation matrix',
    '1. Tìm [escalation matrix](/search?q=escalation+matrix&space=ops-oncall) trong space `ops-oncall`.',
    '2. Xác định severity → làm theo bảng escalate.',
    '3. Nếu chưa có → tạo mới với template SOP, tag `escalation`.',
    '',
    '### Quick links',
    '',
    '- [Submit SOP mới](/artifacts/new?template_key=sop)',
    '- [Tra runbook oncall](/search?space=ops-runbook)',
    '- [Space Ops-Runbook](/artifacts?space=ops-runbook)',
    '- [Space Ops-OnCall](/artifacts?space=ops-oncall)',
    '',
    '### OpenWebUI bot (Ops workspace)',
    '',
    '```',
    '# Ví dụ query trong OpenWebUI chat:',
    'onemcp_search("oncall handoff quy trình", space="ops-oncall")',
    '```',
    '',
    '> Liên hệ admin để join OpenWebUI workspace **Ops-Helper** — scope sẵn Ops spaces.',
    '',
    '### Recommended templates',
    '',
    '| Template | Use case |',
    '|---|---|',
    '| sop | Standard operating procedure — quy trình lặp lại |',
    '| runbook | On-call runbook — symptoms → verify → mitigate |',
    '| postmortem | Post-mortem chi tiết sau incident |',
    '',
    '> **Tip:** Dùng [Saved searches](/search) — lưu query thường dùng khi oncall để truy cập 1 click.',
  ].join('\n'),
};

// ---------------------------------------------------------------------------
// Customer Support — Phase 4 real content
// ---------------------------------------------------------------------------
const support: DeptContent = {
  label: 'Customer Support',
  markdown: [
    '## Chào mừng team Support',
    '',
    'OneMCP lưu FAQ chuẩn, ticket playbook, và escalation path để Support tra nhanh khi xử lý ticket khách.',
    '',
    '<!-- TODO(video-url): embed demo video khi có link -->',
    '<!-- Video demo: [xem hướng dẫn 5 phút](#) -->',
    '',
    '### 3 use case chính',
    '',
    '#### 1. Submit FAQ / playbook mới',
    '1. Vào [New artifact — FAQ](/artifacts/new?template_key=faq) hoặc [Ticket Playbook](/artifacts/new?template_key=ticket_playbook).',
    '2. FAQ: điền **Câu hỏi khách hàng** + **Câu trả lời chuẩn** + nhóm (billing/technical/account).',
    '3. Ticket Playbook: điền **Loại ticket**, **Bước chẩn đoán**, **Phương án xử lý**.',
    '4. Submit → pending → reviewer approve → published và vào space `support-faq`.',
    '',
    '#### 2. Tra FAQ khi trả ticket',
    '1. Vào [Search](/search?space=support-faq) — đã filter sẵn space `support-faq`.',
    '2. Copy keywords từ ticket khách → paste vào search (VN hoặc EN đều được).',
    '3. Click FAQ artifact → copy **Câu trả lời chuẩn** → paste vào ticket reply.',
    '4. Hoặc hỏi OpenWebUI bot: `onemcp_search("lỗi đăng nhập", space="support-faq")`.',
    '',
    '#### 3. Dùng ticket playbook',
    '1. Tìm [ticket playbook](/search?q=ticket+playbook&space=support-faq) theo loại ticket.',
    '2. Đọc **Bước chẩn đoán** → xác định nguyên nhân.',
    '3. Chọn **Phương án xử lý** phù hợp.',
    '4. Nếu cần escalate → xem **Ma trận escalate** trong playbook.',
    '',
    '### Quick links',
    '',
    '- [Submit FAQ mới](/artifacts/new?template_key=faq)',
    '- [Submit Ticket Playbook](/artifacts/new?template_key=ticket_playbook)',
    '- [Tra FAQ Support](/search?space=support-faq)',
    '- [Space Support-FAQ](/artifacts?space=support-faq)',
    '',
    '### OpenWebUI bot',
    '',
    '```',
    '# Ví dụ query trong OpenWebUI chat:',
    'onemcp_search("khách không đăng nhập được", space="support-faq")',
    'onemcp_search("billing refund quy trình")',
    '```',
    '',
    '### Recommended templates',
    '',
    '| Template | Use case |',
    '|---|---|',
    '| faq | Câu hỏi thường gặp — hỏi-đáp chuẩn |',
    '| ticket_playbook | Hướng xử lý ticket theo loại |',
    '| sop | Quy trình nội bộ Support team |',
    '',
    '> **Tip:** Tag FAQ theo product area (billing, login, api) để filter nhanh khi xử lý ticket.',
  ].join('\n'),
};

// ---------------------------------------------------------------------------
// Export map
// ---------------------------------------------------------------------------
export const DEPT_CONTENT: Record<string, DeptContent> = { tech, ops, support };
