import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import type { ReactNode } from 'react';

// (app) route group layout — wraps all authenticated/main app routes with the
// AppShell sidebar. Root layout provides html/body + providers; this layer adds
// the navigation chrome.
// Suspense required: SpaceSwitcher inside AppShell uses useSearchParams.
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
