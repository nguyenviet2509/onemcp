'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { ArtifactVersion } from '../lib/api/artifacts';

// Lazy-load diff library — it uses browser globals, must be client-only.
// react-diff-viewer-continued does not have a default export; use named import via compat shim.
const ReactDiffViewer = dynamic(
  () => import('react-diff-viewer-continued').then((m) => m.default ?? m),
  {
    ssr: false,
    loading: () => <Skeleton className="h-40 w-full" />,
  }
);

// Max body length before showing truncation UI.
const TRUNCATE_LIMIT = 100_000;

function maybetruncate(text: string, showFull: boolean): string {
  if (showFull || text.length <= TRUNCATE_LIMIT) return text;
  return text.slice(0, TRUNCATE_LIMIT) + '\n\n[... truncated — click "Show full" to expand ...]';
}

interface Props {
  /** Two versions to compare. Index 0 = older, index 1 = newer. */
  versions: [ArtifactVersion, ArtifactVersion];
}

// Renders a side-by-side diff between two artifact versions.
// Diff library is lazy-loaded (dynamic import, ssr: false).
// Bodies >100KB are truncated by default with an expand button.
export function VersionDiffView({ versions }: Props) {
  const [showFull, setShowFull] = useState(false);
  const [older, newer] = versions;

  const oldBody = maybetruncate(older.body, showFull);
  const newBody = maybetruncate(newer.body, showFull);
  const isTruncated =
    !showFull && (older.body.length > TRUNCATE_LIMIT || newer.body.length > TRUNCATE_LIMIT);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          v{older.versionNo} → v{newer.versionNo}
        </span>
        {isTruncated && (
          <Button variant="ghost" size="sm" onClick={() => setShowFull(true)}>
            Show full
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border text-xs">
        <ReactDiffViewer
          oldValue={oldBody}
          newValue={newBody}
          splitView
          leftTitle={`v${older.versionNo} — ${new Date(older.submittedAt).toLocaleDateString()}`}
          rightTitle={`v${newer.versionNo} — ${new Date(newer.submittedAt).toLocaleDateString()}`}
          useDarkTheme={false}
          hideLineNumbers={false}
        />
      </div>
    </div>
  );
}
