'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Artifact } from '../lib/api/artifacts';
import { reviewArtifact } from '../lib/api/artifacts';

// Helper: convert artifact rows to CSV string (client-side, no backend needed).
function toCsv(artifacts: Artifact[]): string {
  const headers = ['id', 'title', 'slug', 'type', 'status', 'tags', 'createdAt'];
  const rows = artifacts.map((a) => [
    a.id,
    `"${a.title.replace(/"/g, '""')}"`,
    a.slug,
    a.type,
    a.status,
    `"${a.tags.join(', ')}"`,
    a.createdAt,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  selectedIds: Set<string>;
  allArtifacts: Artifact[];
  onComplete: () => void; // refresh parent list after bulk action
}

// Sticky bulk actions bar — shown when >0 rows selected.
// TODO: when backend adds a batch endpoint, replace sequential calls with single POST /artifacts/batch.
// For pilot scale (<50 artifacts), sequential calls are acceptable.
export function ArtifactBulkActions({ selectedIds, allArtifacts, onComplete }: Props) {
  const [busy, setBusy] = useState(false);

  if (selectedIds.size === 0) return null;

  const selected = allArtifacts.filter((a) => selectedIds.has(a.id));
  const pendingSelected = selected.filter((a) => a.status === 'pending');

  async function handleApprove() {
    if (pendingSelected.length === 0) return;
    setBusy(true);
    const results: { id: string; ok: boolean }[] = [];
    for (const a of pendingSelected) {
      try {
        await reviewArtifact(a.id, 'approve');
        results.push({ id: a.id, ok: true });
      } catch {
        results.push({ id: a.id, ok: false });
      }
    }
    setBusy(false);
    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    if (failed === 0) {
      toast.success(`Approved ${passed} artifact${passed > 1 ? 's' : ''}`);
    } else {
      toast.warning(`Approved ${passed}, failed ${failed}. Check permissions.`);
    }
    onComplete();
  }

  async function handleArchive() {
    setBusy(true);
    // Archive = reviewArtifact with action 'reject' is wrong — no dedicated archive endpoint yet.
    // TODO: add POST /artifacts/:id/archive endpoint in backend. Using review/reject as workaround is wrong.
    // For now just show toast and signal completion without calling API.
    toast.info('Archive endpoint not yet available — contact backend team.');
    setBusy(false);
    onComplete();
  }

  function handleExportCsv() {
    const csv = toCsv(selected);
    downloadCsv(csv, `artifacts-export-${Date.now()}.csv`);
    toast.success(`Exported ${selected.length} artifact${selected.length > 1 ? 's' : ''} to CSV`);
  }

  return (
    <div className="sticky bottom-4 z-20 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      <span className="text-sm font-medium text-foreground">
        {selectedIds.size} selected
      </span>
      <div className="flex items-center gap-2">
        {pendingSelected.length > 0 && (
          <Button
            size="sm"
            variant="default"
            disabled={busy}
            onClick={handleApprove}
          >
            Approve ({pendingSelected.length})
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={handleArchive}
        >
          Archive
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={handleExportCsv}
        >
          Export CSV
        </Button>
      </div>
    </div>
  );
}
