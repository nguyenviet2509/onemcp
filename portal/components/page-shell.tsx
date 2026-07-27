import type { ReactNode } from 'react';
import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageShellProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  children: ReactNode;
}

// Shared layout shell — Option A: px-8 py-6 for hero pages, px-6 py-6 for list pages.
// Breadcrumb uses muted text + slash separator. Header h1 is tracking-tight font-semibold.
export function PageShell({ title, breadcrumb, actions, children }: PageShellProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-6">
      {/* Breadcrumb row — Option A: xs muted text, slash-separated */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-muted-foreground/50">/</span>}
              {item.href ? (
                <Link href={item.href} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Page header — tracking-tight, items-baseline for text alignment */}
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>

      {children}
    </main>
  );
}
