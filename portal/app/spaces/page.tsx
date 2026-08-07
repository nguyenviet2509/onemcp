'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { PageShell } from '@/components/page-shell';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  listSpaces, createSpace, deleteSpace, Space, SpaceVisibility,
} from '@/lib/api/spaces';
import { ApiError } from '@/lib/api-client';
import Link from 'next/link';
import { Pagination, paginateItems } from '@/components/pagination';

interface SpaceFormState {
  name: string;
  slug: string;
  description: string;
  visibility: SpaceVisibility;
}

const EMPTY_FORM: SpaceFormState = { name: '', slug: '', description: '', visibility: 'space' };

// Note: visibility labels are localized inside the component via useTranslations.

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<20 | 10 | 50 | 100>(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<SpaceFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Space | null>(null);
  const [deleting, setDeleting] = useState(false);
  const t = useTranslations('pages.spaces');
  const tCommon = useTranslations('common');
  const tForm = useTranslations('form');

  useEffect(() => {
    listSpaces()
      .then(setSpaces)
      .catch((e) => {
        const msg = e instanceof ApiError ? `${e.status}: ${e.message}` : String(e);
        // 403 = not admin
        setError(e instanceof ApiError && e.status === 403
          ? 'Admin access required to manage spaces.'
          : msg);
      })
      .finally(() => setLoading(false));
  }, []);

  function setField<K extends keyof SpaceFormState>(k: K, v: SpaceFormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      // Auto-derive slug from name if user hasn't manually edited it.
      if (k === 'name' && prev.slug === slugify(prev.name)) {
        next.slug = slugify(v as string);
      }
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    setBusy(true);
    try {
      const created = await createSpace({
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        visibility: form.visibility,
      });
      setSpaces((prev) => [...prev, created]);
      toast.success(t('toasts.created'));
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('toasts.createFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSpace(deleteTarget.slug);
      setSpaces((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success(t('toasts.deleted'));
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('toasts.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  const actions = (
    <Button onClick={() => setCreateOpen(true)}>{t('newSpace')}</Button>
  );

  return (
    <PageShell title={t('title')} actions={error ? undefined : actions}>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      )}

      {!loading && !error && spaces.length === 0 && (
        <EmptyState
          title={t('empty')}
          description={t('emptyDescription')}
          cta={<Button onClick={() => setCreateOpen(true)}>{t('newSpace')}</Button>}
        />
      )}

      {!loading && spaces.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('columns.name')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('columns.slug')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('columns.visibility')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginateItems(spaces, page, pageSize).map((s) => (
                <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.slug}</td>
                  <td className="px-4 py-3">
                    <Badge variant={s.visibility === 'cross_dept' ? 'secondary' : 'outline'}>
                      {s.visibility}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/spaces/${s.slug}`}>
                        <Button variant="outline" size="sm">{tCommon('edit')}</Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(s)}
                      >
                        {tCommon('delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && spaces.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={spaces.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('newSpace')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-name">{tForm('labels.name')} <span aria-hidden className="text-destructive">*</span></Label>
              <Input
                id="sp-name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder={tForm('placeholders.descriptionExample')}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-slug">{tForm('labels.slug')} <span aria-hidden className="text-destructive">*</span></Label>
              <Input
                id="sp-slug"
                value={form.slug}
                onChange={(e) => setField('slug', e.target.value)}
                placeholder="engineering-kb"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-desc">{tForm('labels.description')}</Label>
              <Input
                id="sp-desc"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder={tForm('placeholders.optional')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-visibility">{tForm('labels.visibility')}</Label>
              <select
                id="sp-visibility"
                value={form.visibility}
                onChange={(e) => setField('visibility', e.target.value as SpaceVisibility)}
                className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
              >
                {(['space', 'dept', 'cross_dept'] as SpaceVisibility[]).map((v) => (
                  <option key={v} value={v}>{t(`visibilityLabels.${v}`)}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={busy || !form.name.trim() || !form.slug.trim()}>
                {busy ? tCommon('loading') : tCommon('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('deleteWarning', { name: deleteTarget?.name ?? '' })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {tCommon('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? tCommon('loading') : tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
