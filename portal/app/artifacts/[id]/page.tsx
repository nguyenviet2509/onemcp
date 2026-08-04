'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { AttachmentUploader } from '../../../components/attachment-uploader';
import { MarkdownView } from '../../../components/markdown-view';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button, buttonVariants } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { ApiError } from '../../../lib/api-client';
import { ArtifactDetail, getArtifact } from '../../../lib/api/artifacts';
import { statusVariant } from '../../../lib/status-pill-variants';
import { ArtifactDetailSidebar } from './artifact-detail-sidebar';
import { ArtifactReviewActions } from './artifact-review-actions';

interface Props {
  params: Promise<{ id: string }>;
}

// Header action cluster — star (local toggle), copy link, edit
function HeaderActions({ id, title }: { id: string; title: string }) {
  const [starred, setStarred] = useState(false);

  function copyLink() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success('Link copied'))
      .catch(() => toast.error('Copy failed — clipboard unavailable'));
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setStarred((s) => !s)}
        aria-pressed={starred}
      >
        {starred ? '★' : '☆'} Star
      </Button>
      <Button variant="outline" size="sm" onClick={copyLink}>
        Copy link
      </Button>
      <Link
        href={`/artifacts/${id}/edit`}
        className={buttonVariants({ size: 'sm' })}
      >
        Edit
      </Link>
    </div>
  );
}

// Full-width header block with border-bottom
function DetailHeader({
  id,
  detail,
}: {
  id: string;
  detail: ArtifactDetail;
}) {
  const { artifact, version } = detail;
  const updatedAt = artifact.updatedAt
    ? formatDistanceToNow(new Date(artifact.updatedAt), { addSuffix: true })
    : null;

  return (
    <div className="border-b border-border px-8 py-4">
      {/* Breadcrumb */}
      <nav className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/artifacts" className="hover:text-foreground transition-colors">Artifacts</Link>
        <span>/</span>
        <span>{artifact.type}</span>
        <span>/</span>
        <span className="text-foreground">{artifact.title}</span>
      </nav>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{artifact.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Badge variant={statusVariant(artifact.status)} className="text-xs">
              {artifact.status}
            </Badge>
            {version && <span>v{version.versionNo}</span>}
            {version && <span>·</span>}
            {updatedAt && <span>Updated {updatedAt}</span>}
            {artifact.type && (
              <>
                <span>·</span>
                <span>Type: {artifact.type}</span>
              </>
            )}
          </div>
        </div>
        <HeaderActions id={id} title={artifact.title} />
      </div>
    </div>
  );
}

// --- Main page ---
export default function ArtifactDetailPage({ params }: Props) {
  const { id } = use(params);
  const [detail, setDetail] = useState<ArtifactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    getArtifact(id)
      .then(setDetail)
      .catch((e) =>
        setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e))
      );

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <main className="w-full">
        <div className="px-8 py-4 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="px-8 py-6 space-y-3">
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="px-8 py-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!detail) return null;

  const { artifact, version } = detail;

  return (
    <main className="w-full">
      <DetailHeader id={id} detail={detail} />

      {/* Body: article (left) + sidebar (right) */}
      <div className="grid grid-cols-[1fr_260px]">
        {/* Left — markdown body + attachments + review actions */}
        <div className="px-8 py-6 max-w-5xl">
          {version ? (
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownView source={version.body} />
            </article>
          ) : (
            <p className="text-sm text-muted-foreground">No content version available.</p>
          )}

          {/* Attachments section below article */}
          <section className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 text-sm font-semibold">Attachments</h2>
            <AttachmentUploader artifactId={id} />
          </section>

          {/* Review actions — renders only when version is pending */}
          {version && (
            <ArtifactReviewActions
              artifactId={id}
              versionStatus={version.status}
              onDone={reload}
            />
          )}

          {version?.reviewedAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Reviewed {new Date(version.reviewedAt).toLocaleString()} — {version.status}
              {version.reviewNote && ` · ${version.reviewNote}`}
            </p>
          )}
        </div>

        {/* Right — tags, related, activity */}
        <ArtifactDetailSidebar artifactId={id} tags={artifact.tags} />
      </div>
    </main>
  );
}
