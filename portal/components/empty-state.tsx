import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Single lucide-react icon component (ReactNode) or omit for no icon. Budget: counts toward page icon limit. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** CTA button/link rendered below description. */
  cta?: ReactNode;
}

// Shared empty state — use for every empty list/zero-result/first-run scenario.
// Centered layout, muted colors, dark mode via Tailwind dark: variants.
// Guardrail: pass at most 1 icon (icon budget per design rules).
export function EmptyState({ icon, title, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-secondary-200 bg-secondary-50 px-6 py-16 text-center dark:border-secondary-700 dark:bg-secondary-900/30">
      {icon && (
        <span className="text-secondary-400 dark:text-secondary-500" aria-hidden>
          {icon}
        </span>
      )}
      <p className="text-base font-medium text-secondary-900 dark:text-secondary-100">
        {title}
      </p>
      {description && (
        <p className="max-w-sm text-sm text-secondary-500 dark:text-secondary-400">
          {description}
        </p>
      )}
      {cta && <div className="mt-1">{cta}</div>}
    </div>
  );
}
