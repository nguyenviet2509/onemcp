'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '../../../components/ui/badge';
import { ApiError } from '../../../lib/api-client';
import { ArtifactVersion, listArtifactVersions } from '../../../lib/api/artifacts';

interface Props {
  artifactId: string;
  tags: string[];
}

// Top-3 recent versions shown as ACTIVITY feed
function ActivityFeed({ artifactId }: { artifactId: string }) {
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);

  useEffect(() => {
    listArtifactVersions(artifactId)
      .then((vs) => setVersions(vs.slice(0, 3)))
      .catch((e: unknown) => {
        // Non-critical — sidebar activity failure is silent
        console.warn('activity feed:', e instanceof ApiError ? e.message : e);
      });
  }, [artifactId]);

  if (versions.length === 0) return <p className="text-xs text-muted-foreground">No activity yet.</p>;

  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      {versions.map((v) => (
        <div key={v.id}>
          <span className="text-foreground">v{v.versionNo}</span>{' '}
          {v.status}{' · '}
          {formatDistanceToNow(new Date(v.submittedAt), { addSuffix: true })}
        </div>
      ))}
    </div>
  );
}

// Right sidebar: TAGS + RELATED placeholder + ACTIVITY
export function ArtifactDetailSidebar({ artifactId, tags }: Props) {
  const labelCls = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2';

  return (
    <aside className="space-y-5 border-l border-border px-4 py-6">
      <div>
        <p className={labelCls}>Tags</p>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No tags.</p>
        )}
      </div>

      <div>
        <p className={labelCls}>Related</p>
        {/* No related-artifacts API — graceful empty state */}
        <p className="text-sm text-muted-foreground">No related artifacts yet.</p>
      </div>

      <div>
        <p className={labelCls}>Activity</p>
        <ActivityFeed artifactId={artifactId} />
      </div>
    </aside>
  );
}
