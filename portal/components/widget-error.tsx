'use client';

import { ApiError } from '../lib/api-client';
import { EmptyState } from './empty-state';

// Chuyển raw fetch error thành UI thân thiện.
// 403 = quyền — nhiều widget dashboard cần role admin/dept-scoped; render EmptyState nhẹ nhàng.
// Khác: giữ text-destructive để dev thấy nhưng gọn.
export function WidgetError({ err }: { err: unknown }) {
  const status = err instanceof ApiError ? err.status : undefined;

  if (status === 403) {
    return (
      <EmptyState
        title="Không đủ quyền"
        description="Widget này yêu cầu quyền cao hơn. Đổi username khác (nút 'change' ở header) hoặc truy cập qua mạng nội bộ."
      />
    );
  }

  const msg = err instanceof Error ? err.message : String(err);
  // Truncate JSON blobs xuống 1 dòng thay vì trả nguyên payload cho user.
  const clean = msg.length > 140 ? `${msg.slice(0, 140)}…` : msg;
  return <p className="text-sm text-destructive">{clean}</p>;
}
