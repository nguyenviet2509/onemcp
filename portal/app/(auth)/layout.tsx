import type { ReactNode } from 'react';

// (auth) route group layout — bare pass-through, no AppShell/sidebar.
// Used by /login. Root layout (app/layout.tsx) already provides:
// html, body, Inter font, ThemeProvider, NextIntlClientProvider, SpaceProvider.
// Nothing extra needed here.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
