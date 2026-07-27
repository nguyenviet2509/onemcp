import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AppShell } from '../components/app-shell';
import { SpaceProvider } from '../lib/space-context';

export const metadata: Metadata = {
  title: 'OneMCP',
  description: 'Internal MCP server for departments — v1 pilot Kỹ thuật',
};

// Root layout — AppShell wraps ALL routes (SSO /login page not yet implemented).
// When SSO ships: detect pathname === '/login' and render PageShell instead.
// SpaceProvider wraps AppShell so space context is available everywhere.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <body className="min-h-screen">
        <SpaceProvider>
          {/* AppShell wraps all routes — sidebar + main content area */}
          {/* Suspense required: SpaceSwitcher uses useSearchParams inside AppShell */}
          <Suspense>
            <AppShell>
              {children}
            </AppShell>
          </Suspense>
        </SpaceProvider>
      </body>
    </html>
  );
}
