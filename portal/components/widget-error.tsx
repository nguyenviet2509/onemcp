'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '../lib/api-client';
import { EmptyState } from './empty-state';

// Convert raw fetch error into user-friendly UI.
// 403 = permission — many dashboard widgets require admin/dept-scoped role;
// render a soft EmptyState. Anything else: keep it terse in text-destructive.
export function WidgetError({ err }: { err: unknown }) {
  const status = err instanceof ApiError ? err.status : undefined;
  const t = useTranslations('pages.dashboard.widgets');

  if (status === 403) {
    return (
      <EmptyState
        title={t('unauthorized')}
        description={t('unauthorizedDesc')}
      />
    );
  }

  const msg = err instanceof Error ? err.message : String(err);
  // Truncate JSON blobs to 1 line instead of returning the raw payload to the user.
  const clean = msg.length > 140 ? `${msg.slice(0, 140)}…` : msg;
  return <p className="text-sm text-destructive">{clean}</p>;
}
