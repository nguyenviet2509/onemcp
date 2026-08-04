'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
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
  const tWidgets = useTranslations('widgets');

  useEffect(() => {
    listArtifactVersions(artifactId)
      .then((vs) => setVersions(vs.slice(0, 3)))
      .catch((e: unknown) => {
        // Non-critical — sidebar activity failure is silent
        console.warn('activity feed:', e instanceof ApiError ? e.message : e);
      });
  }, [artifactId]);

  if (versions.length === 0) return <p className="text-xs text-muted-foreground">{tWidgets('noRecentActivity')}</p>;

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
  const labelCls = 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2';
  const t = useTranslations('pages.artifactsDetailSidebar');
  const tWidgets = useTranslations('widgets');

  return (
    <aside className="space-y-5 border-l border-border px-4 py-6">
      <div>
        <p className={labelCls}>{t('tags')}</p>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{tWidgets('noTags')}</p>
        )}
      </div>

      <div>
        <p className={labelCls}>{t('related')}</p>
        {/* No related-artifacts API — graceful empty state */}
        <p className="text-sm text-muted-foreground">—</p>
      </div>

      <div>
        <p className={labelCls}>{t('activity')}</p>
        <ActivityFeed artifactId={artifactId} />
      </div>
    </aside>
  );
}
