'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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

const VISIBILITY_LABELS: Record<SpaceVisibility, string> = {
  space: 'space (owner + explicit members)',
  dept: 'dept (all members of a department)',
  cross_dept: 'cross-dept (all authenticated users)',
};

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
      toast.success('Space created');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
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
      toast.success('Space deleted');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const actions = (
    <Button onClick={() => setCreateOpen(true)}>New space</Button>
  );

  return (
    <PageShell title="Spaces" actions={error ? undefined : actions}>
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
          title="No spaces yet"
          description="Create a space to organise artifacts by department or topic."
          cta={<Button onClick={() => setCreateOpen(true)}>New space</Button>}
        />
      )}

      {!loading && spaces.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Visibility</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
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
                        <Button variant="outline" size="sm">Edit</Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(s)}
                      >
                        Delete
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
            <DialogTitle>New space</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-name">Name <span aria-hidden className="text-destructive">*</span></Label>
              <Input
                id="sp-name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Engineering KB"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-slug">Slug <span aria-hidden className="text-destructive">*</span></Label>
              <Input
                id="sp-slug"
                value={form.slug}
                onChange={(e) => setField('slug', e.target.value)}
                placeholder="engineering-kb"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-desc">Description</Label>
              <Input
                id="sp-desc"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-visibility">Visibility</Label>
              <select
                id="sp-visibility"
                value={form.visibility}
                onChange={(e) => setField('visibility', e.target.value as SpaceVisibility)}
                className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
              >
                {(Object.keys(VISIBILITY_LABELS) as SpaceVisibility[]).map((v) => (
                  <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !form.name.trim() || !form.slug.trim()}>
                {busy ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete space?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Space <span className="font-medium">"{deleteTarget?.name}"</span> and all its settings
            will be permanently deleted. Artifacts in this space are NOT deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
