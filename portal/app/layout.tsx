import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Nav } from '../components/nav';
import { SpaceProvider } from '../lib/space-context';

export const metadata: Metadata = {
  title: 'OneMCP',
  description: 'Internal MCP server for departments — v1 pilot Kỹ thuật',
};

// searchParams not available in root layout (Next 15 limitation).
// SpaceProvider reads initialSlug from localStorage on client hydration;
// URL param sync is handled inside SpaceSwitcher via useSearchParams.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-secondary-50 text-secondary-900 dark:bg-secondary-950 dark:text-secondary-100">
        {/* SpaceProvider wraps all children — space context available app-wide */}
        <SpaceProvider>
          {/* Nav includes SpaceSwitcher (client) — wrapped in Suspense for useSearchParams */}
          <Suspense>
            <Nav />
          </Suspense>
          {children}
        </SpaceProvider>
      </body>
    </html>
  );
}
