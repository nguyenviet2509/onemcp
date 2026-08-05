# OneMCP GitLab SSO — User Guide

> **Hiệu lực từ:** Phase 3 rollout (tháng 8/2026)

---

## Tại sao SSO

OneMCP hiện tại yêu cầu login bằng tài khoản iNET GitLab thay vì username local. Điều này:
- Đồng bộ credential với tổ chức (dùng chung 1 account iNET).
- Tự động cấp quyền dựa trên vai trò admin bootstrap từ `.env`.
- Tăng độ an toàn: mật khẩu được quản lý bởi iNET GitLab, không lưu ở OneMCP.

---

## Cách login lần đầu

### Bước 1: Truy cập OneMCP

Mở https://202.92.5.113/ trong trình duyệt.

> ⚠️ **Nếu thấy lỗi TLS:** Đây là self-signed certificate. Click "Advanced" → "Proceed to site" (hoặc tương đương trong browser của bạn). Lỗi này bình thường khi dùng IP public thay vì domain.

### Bước 2: Tự động chuyển trang login

Portal sẽ tự động redirect bạn sang trang `/login` nếu chưa authenticate.

Bạn sẽ thấy một nút **"Sign in with iNET GitLab"**.

### Bước 3: Authorize ứng dụng

Click nút "Sign in with iNET GitLab" → browser chuyển sang https://gitlab.inet.vn.

Bạn sẽ thấy màn hình yêu cầu **Authorize OneMCP** với quyền hạn `read_user` (chỉ đọc email + tên).

> 📌 **Ghi chú:** Phạm vi quyền hạn hạn chế. OneMCP KHÔNG thể truy cập repo, tạo branch, hoặc modify project của bạn.

Click **Authorize** để tiếp tục.

### Bước 4: Quay lại OneMCP dashboard

Sau khi authorize, GitLab chuyển hướng bạn trở lại OneMCP. Cookie session sẽ được lưu tự động. Bạn sẽ thấy dashboard với username của bạn ở góc dưới cùng sidebar.

---

## Session behavior

| Đặc tính | Giá trị |
|---|---|
| **Thời hạn** | 24 giờ kể từ lần truy cập cuối cùng |
| **Tự động gia hạn** | Có — mỗi request active thêm 24h |
| **Lưu ở đâu** | Cookie + Redis server-side |
| **Loại cookie** | Secure (HTTPS-only), SameSite=Strict |

**Ví dụ:**
- Lúc 9:00 AM: Bạn login.
- Lúc 2:00 PM: Session vẫn active (hơn 5h đã trôi), click 1 artifact → session gia hạn đến 2:00 PM hôm sau.
- Lúc 2:00 PM hôm sau: Session hết hạn, bạn bị logout.
- Lúc 2:01 PM: Truy cập /artifacts → tự động redirect /login → click "Sign in with GitLab" lại.

---

## Logout

Ở góc dưới cùng sidebar, click menu dropdown với tên user của bạn.

Chọn **Logout** → cookie session xóa → redirect sang `/login`.

> 💡 **Mẹo:** Nếu logout ở OneMCP nhưng không logout ở GitLab, lần login tiếp theo sẽ tự động authorize (vì GitLab session còn). Để logout hoàn toàn, logout ở GitLab sau.

---

## Troubleshooting

| Triệu chứng | Nguyên nhân | Cách khắc phục |
|---|---|---|
| **Sau click "Sign in" bị `ERR_SSL_PROTOCOL_ERROR`** | Network không tin self-signed cert hoặc firewall block | Kiểm tra VPN kết nối. Nếu dùng công ty network khác, contact iNET IT whitelist public IP 202.92.5.113. |
| **Login thành công nhưng bị redirect ngược lại `/login`** | Cookie SameSite mismatch hoặc browser strict mode | Clear browser cookie (F12 → Application → Cookies → delete `session`), retry login. Nếu vẫn fail, contact OneMCP admin. |
| **Thấy dòng "User not found"** | GitLab account không được provision ở OneMCP | Contact OneMCP admin + iNET GitLab admin. Cần add email @inet.vn vào allowlist. |

---

## FAQ

### Q: Có cần đổi mật khẩu OneMCP không?

**A:** Không. Mật khẩu được quản lý hoàn toàn bởi iNET GitLab. OneMCP không lưu mật khẩu.

### Q: Session hết hạn khi nào?

**A:** 24 giờ **không hoạt động**. Nếu bạn luôn click / submit / search mỗi 12 giờ, session không bao giờ hết. Nếu để máy nghỉ 24+ giờ mà không truy cập, session hết → logout tự động.

### Q: Tôi có thể login từ nhiều tab cùng lúc không?

**A:** Có. Cùng 1 session cookie, mở nhiều tab → mọi tab đều authenticated. Logout ở 1 tab → tất cả logout.

### Q: Nếu đổi email ở iNET GitLab, OneMCP tự động update không?

**A:** Không tự động. Email cũ sẽ còn trong OneMCP (user mapping lưu khi login lần đầu). Để update, contact OneMCP admin re-provision.

### Q: Có API key nào cho programmatic access không?

**A:** Có. Sau khi login, vào `/profile/api-keys` → tạo key → dùng header `X-Onemcp-Key: <key>` thay vì cookie. API key không hết hạn (hoặc hết theo thời gian cấu hình). Xem [api-keys.md](api-keys.md).

---

## Security tips

- **Không chia sẻ session cookie:** Cookie chứa session ID — nếu bị lộ, ai có nó cũng có thể fake login là bạn.
- **Logout trước khi rời máy tính chung:** Không để cookie lơ lửng trên PC công cộng.
- **API key:** Nếu dùng key cho CI/CD, set expiry ngắn (30-90 ngày) + rotate định kỳ.
