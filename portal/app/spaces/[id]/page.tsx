'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getSpace, updateSpace, Space, SpaceVisibility } from '@/lib/api/spaces';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api-client';

export default function SpaceEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<SpaceVisibility>('space');
  const [busy, setBusy] = useState(false);
  const t = useTranslations('pages.spaces');
  const tCommon = useTranslations('common');
  const tForm = useTranslations('form');
  const tNav = useTranslations('nav');

  useEffect(() => {
    // id param is the space id; fetch by slug if backend supports it,
    // else use id directly. getSpace accepts slug — pass id as-is (slug == id in list).
    getSpace(id)
      .then((s) => {
        setSpace(s);
        setName(s.name);
        setDescription(s.description ?? '');
        setVisibility(s.visibility);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!space) return;
    setBusy(true);
    try {
      await updateSpace(space.slug, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        visibility,
      });
      toast.success(t('toasts.updated'));
      router.push('/spaces');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('toasts.updateFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title={t('editTitle')}
      breadcrumb={[
        { label: tNav('spaces'), href: '/spaces' },
        { label: space?.name ?? id },
      ]}
    >
      {loading && (
        <div className="space-y-4 max-w-lg">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-48" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && space && (
        <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">{tForm('labels.name')}</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-slug">{tForm('labels.slug')}</Label>
            <Input
              id="edit-slug"
              value={space.slug}
              disabled
              className="font-mono text-xs opacity-70"
              aria-describedby="slug-hint"
            />
            <p id="slug-hint" className="text-xs text-muted-foreground">
              {tForm('hints.slugImmutable')}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-desc">{tForm('labels.description')}</Label>
            <Input
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tForm('placeholders.optional')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-visibility">{tForm('labels.visibility')}</Label>
            <select
              id="edit-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as SpaceVisibility)}
              className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
            >
              {(['space', 'dept', 'cross_dept'] as SpaceVisibility[]).map((v) => (
                <option key={v} value={v}>{t(`visibilityLabels.${v}`)}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? tCommon('saving') : tCommon('save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/spaces')}
              disabled={busy}
            >
              {tCommon('cancel')}
            </Button>
          </div>
        </form>
      )}
    </PageShell>
  );
}
