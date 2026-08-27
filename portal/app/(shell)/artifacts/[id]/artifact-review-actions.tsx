'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { reviewArtifact } from '@/lib/api/artifacts';

interface Props {
  artifactId: string;
  versionStatus: string;
  onDone: () => void;
}

// Renders only when versionStatus === 'pending'; backend enforces role (contributor → 403)
export function ArtifactReviewActions({ artifactId, versionStatus, onDone }: Props) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('pages.artifactsReviewActions');
  const tReview = useTranslations('pages.artifactsReview');

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
    <section className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
      <h2 className="text-sm font-semibold">{tReview('title')}</h2>
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder={t('placeholder')}
        className="mt-2 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-3 focus:ring-ring/15 focus:border-foreground"
        maxLength={1000}
      />
      <div className="mt-2 flex gap-2">
        <Button disabled={busy} onClick={() => handleReview('approve')} size="sm">
          {t('approve')}
        </Button>
        <Button disabled={busy} onClick={() => handleReview('reject')} variant="destructive" size="sm">
          {t('reject')}
        </Button>
      </div>
    </section>
  );
}
