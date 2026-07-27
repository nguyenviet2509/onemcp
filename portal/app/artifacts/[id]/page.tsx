'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { AttachmentUploader } from '../../../components/attachment-uploader';
import { MarkdownView } from '../../../components/markdown-view';
import { PageShell } from '../../../components/page-shell';
import { VersionDiffView } from '../../../components/version-diff-view';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button, buttonVariants } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { ApiError } from '../../../lib/api-client';
import {
  ArtifactDetail,
  ArtifactVersion,
  getArtifact,
  listArtifactVersions,
  reviewArtifact,
} from '../../../lib/api/artifacts';

// STATUS_CLASS replaced by statusVariant() from lib/status-pill-variants.ts
import { statusVariant } from '../../../lib/status-pill-variants';

interface Props {
  params: Promise<{ id: string }>;
}

// --- History tab inner component ---
function HistoryTab({ artifactId }: { artifactId: string }) {
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    listArtifactVersions(artifactId)
      .then(setVersions)
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  }, [artifactId]);

  if (loading) return <Skeleton className="h-32 w-full" />;
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground">No version history available.</p>;
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // keep last two
      return [...prev, id];
    });
  }

  // Find the two selected versions for diff (older first).
  const diffPair =
    selected.length === 2
      ? ([
          versions.find((v) => v.id === selected[0])!,
          versions.find((v) => v.id === selected[1])!,
        ].sort((a, b) => a.versionNo - b.versionNo) as [ArtifactVersion, ArtifactVersion])
      : null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Select 2 versions to compare side-by-side.
      </p>
      <ul className="space-y-2">
        {versions.map((v) => {
          const isSelected = selected.includes(v.id);
          return (
            <li
              key={v.id}
              onClick={() => toggleSelect(v.id)}
              className={`cursor-pointer rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">v{v.versionNo}</span>
                <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(v.submittedAt).toLocaleString()}
                {v.reviewedAt && ` · reviewed ${new Date(v.reviewedAt).toLocaleString()}`}
              </p>
            </li>
          );
        })}
      </ul>

      {diffPair && (
        <div className="mt-4">
          <VersionDiffView versions={diffPair} />
        </div>
      )}
    </div>
  );
}

// --- Review actions sub-section (used inside View tab) ---
function ReviewActions({
  artifactId,
  versionStatus,
  onDone,
}: {
  artifactId: string;
  versionStatus: string;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (versionStatus !== 'pending') return null;

  async function handleReview(action: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      await reviewArtifact(artifactId, action, note || undefined);
      setNote('');
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <h2 className="text-sm font-semibold">Review actions (maintainer only)</h2>
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Review note (optional)..."
        className="mt-2 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
        maxLength={1000}
      />
      <div className="mt-2 flex gap-2">
        <Button disabled={busy} onClick={() => handleReview('approve')} size="sm">
          Approve
        </Button>
        <Button
          disabled={busy}
          onClick={() => handleReview('reject')}
          variant="destructive"
          size="sm"
        >
          Reject
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Backend enforces role — contributors receive 403.
      </p>
    </section>
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

  const artifact = detail?.artifact;
  const version = detail?.version;

  return (
    <PageShell
      title={artifact?.title ?? 'Artifact detail'}
      breadcrumb={[
        { label: 'Artifacts', href: '/artifacts' },
        { label: artifact?.title ?? id },
      ]}
      actions={
        artifact ? (
          <Link href={`/artifacts/${id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Edit
          </Link>
        ) : undefined
      }
    >
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {detail && artifact && (
        <>
          {/* Meta row */}
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="template" className="font-mono">{artifact.type}</Badge>
            <Badge variant={statusVariant(artifact.status)}>{artifact.status}</Badge>
            <code className="font-mono text-xs">{artifact.slug}</code>
            {version && (
              <>
                <span>·</span>
                <span>v{version.versionNo}</span>
                <span>·</span>
                <span>{new Date(version.submittedAt).toLocaleString()}</span>
              </>
            )}
          </div>

          {artifact.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1">
              {artifact.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {/* Tabs: View | Edit | History | Attachments */}
          <Tabs defaultValue="view">
            <TabsList variant="line">
              <TabsTrigger value="view">View</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
            </TabsList>

            {/* View tab — read-only markdown + review actions */}
            <TabsContent value="view" className="mt-4">
              {version ? (
                <article className="rounded-lg border border-border bg-card p-6">
                  <MarkdownView source={version.body} />
                </article>
              ) : (
                <p className="text-sm text-muted-foreground">No content version available.</p>
              )}
              {version && (
                <ReviewActions
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
            </TabsContent>

            {/* Edit tab — navigate to dedicated edit page (preserves existing edit flow) */}
            <TabsContent value="edit" className="mt-4">
              <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                <p className="mb-3">
                  Editing creates a new pending version for review.
                </p>
                <Link
                  href={`/artifacts/${id}/edit`}
                  className={buttonVariants({ size: 'sm' })}
                >
                  Open editor
                </Link>
              </div>
            </TabsContent>

            {/* History tab — version list + diff */}
            <TabsContent value="history" className="mt-4">
              <HistoryTab artifactId={id} />
            </TabsContent>

            {/* Attachments tab */}
            <TabsContent value="attachments" className="mt-4">
              <AttachmentUploader artifactId={id} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </PageShell>
  );
}
