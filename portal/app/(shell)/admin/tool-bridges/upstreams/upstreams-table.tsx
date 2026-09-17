'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/empty-state';
import { ToolUpstream, disableUpstream, updateUpstream } from '@/lib/api/tool-bridges-api';
import { ApiError } from '@/lib/api-client';
import { UpstreamFormModal } from './upstream-form-modal';

interface Props {
  upstreams: ToolUpstream[];
  loading: boolean;
  onListChange: (updated: ToolUpstream[]) => void;
}

export function UpstreamsTable({ upstreams, loading, onListChange }: Props) {
  const [editTarget, setEditTarget] = useState<ToolUpstream | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ToolUpstream | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function handleSaved(saved: ToolUpstream) {
    onListChange(
      editTarget
        ? upstreams.map((u) => (u.id === saved.id ? saved : u))
        : [saved, ...upstreams],
    );
  }

  function openEdit(u: ToolUpstream) {
    setEditTarget(u);
    setFormOpen(true);
  }

  function openNew() {
    setEditTarget(null);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await disableUpstream(deleteTarget.id);
      onListChange(upstreams.filter((u) => u.id !== deleteTarget.id));
      toast.success('Upstream disabled');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Disable failed');
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggle(u: ToolUpstream) {
    setTogglingId(u.id);
    const prev = u.enabled;
    // Optimistic update
    onListChange(upstreams.map((x) => (x.id === u.id ? { ...x, enabled: !prev } : x)));
    try {
      const updated = await updateUpstream(u.id, { enabled: !prev });
      onListChange(upstreams.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      // Rollback
      onListChange(upstreams.map((x) => (x.id === u.id ? { ...x, enabled: prev } : x)));
      toast.error(e instanceof ApiError ? e.message : 'Toggle failed');
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={openNew}>New upstream</Button>
      </div>

      {upstreams.length === 0 ? (
        <EmptyState title="No upstreams" description="Register an upstream HTTP API to start bridging tools."
          cta={<Button onClick={openNew}>New upstream</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Base URL</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Timeout</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {upstreams.map((u) => (
                <tr key={u.id} className="bg-card hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-xs">{u.baseUrl}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.timeoutMs}ms</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.enabled ? 'secondary' : 'outline'}>
                      {u.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm"
                        onClick={() => handleToggle(u)} disabled={togglingId === u.id}>
                        {u.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(u)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UpstreamFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        editTarget={editTarget}
        onSaved={handleSaved}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Disable upstream?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Upstream &quot;{deleteTarget?.name}&quot; will be disabled (soft). Bridges referencing it will stop working.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Disabling…' : 'Disable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
