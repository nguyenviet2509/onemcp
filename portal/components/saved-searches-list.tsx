'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// Trash2Icon removed (icon budget: 0 outside sidebar-nav). Using text label.
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SavedSearch, listMySaved, deleteSaved } from '@/lib/api/saved-searches';
import { ApiError } from '@/lib/api-client';

// Converts a saved search back to URL search params for /search navigation.
function savedToUrl(s: SavedSearch): string {
  const p = new URLSearchParams();
  p.set('q', s.query);
  if (s.mode) p.set('mode', s.mode);
  if (s.filters.spaceId) p.set('space', s.filters.spaceId);
  if (s.filters.templateKey) p.set('template_key', s.filters.templateKey);
  if (s.filters.tags?.length) p.set('tags', s.filters.tags.join(','));
  if (s.filters.dept) p.set('dept', s.filters.dept);
  return `/search?${p.toString()}`;
}

export function SavedSearchesList() {
  const router = useRouter();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SavedSearch | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    listMySaved()
      .then(setItems)
      .catch(() => {}) // silent — sidebar shouldn't block UI
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSaved(deleteTarget.id);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      toast.success('Saved search deleted');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="px-3 pb-2">
      {loading && (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-full rounded" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-xs text-muted-foreground">No saved searches yet.</p>
      )}

      {!loading && items.length > 0 && (
        <ul className="space-y-0.5">
          {items.map((s) => (
            <li key={s.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => router.push(savedToUrl(s))}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-muted truncate"
                title={s.query}
              >
                <span className="truncate">{s.name}</span>
                {s.mode && (
                  <Badge variant="outline" className="shrink-0 font-mono text-[10px] px-1 py-0">
                    {s.mode}
                  </Badge>
                )}
              </button>
              <button
                type="button"
                aria-label={`Delete "${s.name}"`}
                onClick={() => setDeleteTarget(s)}
                className="hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
              >
                del
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete saved search?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{deleteTarget?.name}" will be permanently removed.
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
    </div>
  );
}
