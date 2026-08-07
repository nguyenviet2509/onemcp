import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import { ThemeProvider } from 'next-themes';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { AppShell } from '../components/app-shell';
import { SpaceProvider } from '../lib/space-context';
import { Toaster } from '../components/ui/sonner';

// Self-hosted via next/font — no CDN runtime call. Latin + Vietnamese subset.
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OneMCP',
  description: 'Internal MCP server for departments — v1 pilot Kỹ thuật',
};

// Root layout — AppShell wraps ALL routes (SSO /login page not yet implemented).
// When SSO ships: detect pathname === '/login' and render PageShell instead.
// ThemeProvider manages dark/light class on <html>; defaultTheme="dark" preserves
// existing dark-first design. SpaceProvider wraps AppShell for space context.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Locale + messages resolved server-side via i18n/request.ts (cookie-based).
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <SpaceProvider>
              {/* AppShell wraps all routes — sidebar + main content area */}
              {/* Suspense required: SpaceSwitcher uses useSearchParams inside AppShell */}
              <Suspense>
                <AppShell>
                  {children}
                </AppShell>
              </Suspense>
              <Toaster position="top-right" richColors />
            </SpaceProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
