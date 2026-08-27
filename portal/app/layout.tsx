import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
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

// Root layout — chỉ giữ providers + <html>/<body>. AppShell (sidebar + main)
// moved xuống `(shell)/layout.tsx` để route `/auth/*` render bare login screen
// không bị bọc sidebar. Bất kỳ route ngoài `(shell)` group (auth, api) sẽ
// render trong root layout trần này.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <SpaceProvider>
              {children}
              <Toaster position="top-right" richColors />
            </SpaceProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
