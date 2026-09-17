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
import { ToolBridge, ToolUpstream, disableBridge, updateBridge } from '@/lib/api/tool-bridges-api';
import { ApiError } from '@/lib/api-client';
import { BridgeFormModal } from './bridge-form-modal';
import { BridgeTestModal } from './bridge-test-modal';

interface Props {
  bridges: ToolBridge[];
  upstreams: ToolUpstream[];
  loading: boolean;
  onListChange: (updated: ToolBridge[]) => void;
}

export function BridgesTable({ bridges, upstreams, loading, onListChange }: Props) {
  const [editTarget, setEditTarget] = useState<ToolBridge | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ToolBridge | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testTarget, setTestTarget] = useState<ToolBridge | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const upstreamMap = Object.fromEntries(upstreams.map((u) => [u.id, u.name]));

  function handleSaved(saved: ToolBridge) {
    onListChange(
      editTarget
        ? bridges.map((b) => (b.id === saved.id ? saved : b))
        : [saved, ...bridges],
    );
  }

  function openEdit(b: ToolBridge) {
    setEditTarget(b);
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
      await disableBridge(deleteTarget.id);
      onListChange(bridges.filter((b) => b.id !== deleteTarget.id));
      toast.success('Bridge disabled');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Disable failed');
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggle(b: ToolBridge) {
    setTogglingId(b.id);
    const prev = b.enabled;
    onListChange(bridges.map((x) => (x.id === b.id ? { ...x, enabled: !prev } : x)));
    try {
      const updated = await updateBridge(b.id, { enabled: !prev });
      onListChange(bridges.map((x) => (x.id === b.id ? updated : x)));
    } catch (e) {
      onListChange(bridges.map((x) => (x.id === b.id ? { ...x, enabled: prev } : x)));
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
        <Button onClick={openNew} disabled={upstreams.length === 0}>New bridge</Button>
      </div>
      {upstreams.length === 0 && (
        <p className="text-xs text-muted-foreground mb-2">Create an upstream first before adding bridges.</p>
      )}

      {bridges.length === 0 ? (
        <EmptyState title="No bridges" description="Map a tool to an upstream endpoint."
          cta={<Button onClick={openNew} disabled={upstreams.length === 0}>New bridge</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Upstream</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method + path</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Permission ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bridges.map((b) => (
                <tr key={b.id} className="bg-card hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {upstreamMap[b.upstreamId] ?? b.upstreamId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <span className="mr-1.5 rounded bg-muted px-1 py-0.5">{b.method}</span>
                    {b.path}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[160px]">
                    {b.permissionId}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={b.enabled ? 'secondary' : 'outline'}>
                      {b.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm"
                        onClick={() => handleToggle(b)} disabled={togglingId === b.id}>
                        {b.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(b)}>Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => setTestTarget(b)}>Test</Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(b)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BridgeFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        editTarget={editTarget}
        upstreams={upstreams}
        onSaved={handleSaved}
      />

      <BridgeTestModal
        open={!!testTarget}
        onOpenChange={(o) => { if (!o) setTestTarget(null); }}
        bridge={testTarget}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Disable bridge?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bridge &quot;{deleteTarget?.name}&quot; will be disabled (soft). MCP tool calls routing through it will fail.
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
