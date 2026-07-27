import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** Single lucide-react icon component (ReactNode) or omit for no icon. Budget: counts toward page icon limit. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** CTA button/link rendered below description. */
  cta?: ReactNode;
  /**
   * Size variant:
   * - 'default' — full padding + icon, for page-level empty states
   * - 'compact' — reduced padding, no icon slot, small text; for sidebar widgets
   */
  size?: 'default' | 'compact';
}

// Shared empty state — use for every empty list/zero-result/first-run scenario.
// Centered layout, muted colors, dark mode via Tailwind dark: variants.
// Guardrail: pass at most 1 icon (icon budget per design rules).
export function EmptyState({ icon, title, description, cta, size = 'default' }: EmptyStateProps) {
  const isCompact = size === 'compact';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center',
        'border-secondary-200 bg-secondary-50 dark:border-secondary-700 dark:bg-secondary-900/30',
        isCompact ? 'px-3 py-4' : 'px-6 py-16 gap-3',
      )}
    >
      {/* Icon shown only in default size */}
      {!isCompact && icon && (
        <span className="text-secondary-400 dark:text-secondary-500" aria-hidden>
          {icon}
        </span>
      )}
      <p
        className={cn(
          'font-medium text-secondary-900 dark:text-secondary-100',
          isCompact ? 'text-xs text-muted-foreground' : 'text-base',
        )}
      >
        {title}
      </p>
      {description && !isCompact && (
        <p className="max-w-sm text-sm text-secondary-500 dark:text-secondary-400">
          {description}
        </p>
      )}
      {cta && !isCompact && <div className="mt-1">{cta}</div>}
    </div>
  );
}
