import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** Single lucide-react icon component (ReactNode) or omit for no icon. */
  icon?: ReactNode;
  title: string;
  description?: string;
  cta?: ReactNode;
  /**
   * Size variant:
   * - 'default' — full padding, for page-level empty states
   * - 'compact' — reduced padding, small text; for sidebar widgets
   */
  size?: 'default' | 'compact';
}

// Option A empty state: no bg fill, just border-dashed border-border.
// Muted text, clean centered layout. No emoji.
export function EmptyState({ icon, title, description, cta, size = 'default' }: EmptyStateProps) {
  const isCompact = size === 'compact';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center',
        isCompact ? 'px-3 py-4' : 'px-6 py-12 gap-3',
      )}
    >
      {!isCompact && icon && (
        <span className="text-muted-foreground" aria-hidden>
          {icon}
        </span>
      )}
      <p className={cn('font-medium', isCompact ? 'text-xs text-muted-foreground' : 'text-sm text-foreground')}>
        {title}
      </p>
      {description && !isCompact && (
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {cta && !isCompact && <div className="mt-1">{cta}</div>}
    </div>
  );
}
