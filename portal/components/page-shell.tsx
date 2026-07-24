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

// Shared layout shell — every list/detail/form page MUST use this component.
// Enforces consistent max-width, padding, header slot, and breadcrumb row.
// Dark mode handled via Tailwind dark: variants using design tokens.
export function PageShell({ title, breadcrumb, actions, children }: PageShellProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      {/* Breadcrumb row */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-sm text-secondary-500 dark:text-secondary-400">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              {item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-secondary-900 dark:text-secondary-100">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-secondary-900 dark:text-secondary-50">
          {title}
        </h1>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>

      {/* Main content */}
      {children}
    </main>
  );
}
