import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

// Route group layout — mọi UI route dưới `(shell)/*` được bọc bởi AppShell
// (sidebar 240px + main content). Trang login `/auth/*` nằm ngoài group nên
// render bare, không có sidebar. Suspense boundary cần cho các descendant
// dùng useSearchParams (SpaceSwitcher trong AppShell).
export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
