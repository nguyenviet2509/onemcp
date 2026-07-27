import type { BadgeVariant } from '@/components/ui/badge';
import type { ArtifactStatus } from '@/lib/api/artifacts';

// Maps artifact status string → semantic Badge variant.
// Used across artifacts list, detail, review queue, search results, dashboard.
// Phase 3: consolidates all hard-coded STATUS_CLASSES maps in the codebase.
export function statusVariant(status: ArtifactStatus | string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    published: 'status-published',
    pending:   'status-pending',
    rejected:  'status-rejected',
    archived:  'status-archived',
    // 'draft' treated as pending for display purposes
    draft:     'status-pending',
  };
  return map[status] ?? 'outline';
}
