'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ToolUpstream, CreateUpstreamPayload, UpdateUpstreamPayload,
  createUpstream, updateUpstream,
} from '@/lib/api/tool-bridges-api';
import { ApiError } from '@/lib/api-client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget: ToolUpstream | null;
  onSaved: (upstream: ToolUpstream) => void;
}

interface FormState {
  name: string;
  baseUrl: string;
  bearer: string;
  timeoutMs: string;
  enabled: boolean;
}

const EMPTY: FormState = { name: '', baseUrl: '', bearer: '', timeoutMs: '10000', enabled: true };

function formFromUpstream(u: ToolUpstream): FormState {
  return { name: u.name, baseUrl: u.baseUrl, bearer: '', timeoutMs: String(u.timeoutMs), enabled: u.enabled };
}

export function UpstreamFormModal({ open, onOpenChange, editTarget, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showBearer, setShowBearer] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editTarget ? formFromUpstream(editTarget) : EMPTY);
      setShowBearer(false);
    }
  }, [open, editTarget]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const timeoutMs = parseInt(form.timeoutMs, 10);
    if (isNaN(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
      toast.error('Timeout must be 100–120000 ms');
      return;
    }
    setBusy(true);
    try {
      let saved: ToolUpstream;
      if (editTarget) {
        const payload: UpdateUpstreamPayload = {
          name: form.name.trim(),
          baseUrl: form.baseUrl.trim(),
          timeoutMs,
          enabled: form.enabled,
        };
        if (form.bearer.trim()) payload.bearer = form.bearer.trim();
        saved = await updateUpstream(editTarget.id, payload);
      } else {
        const payload: CreateUpstreamPayload = {
          name: form.name.trim(),
          baseUrl: form.baseUrl.trim(),
          bearer: form.bearer.trim(),
          timeoutMs,
          enabled: form.enabled,
        };
        saved = await createUpstream(payload);
      }
      onSaved(saved);
      onOpenChange(false);
      toast.success(editTarget ? 'Upstream updated' : 'Upstream created');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const isEdit = !!editTarget;
  const canSubmit = form.name.trim() && form.baseUrl.trim() && (isEdit || form.bearer.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit upstream' : 'New upstream'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="us-name">Name <span aria-hidden className="text-destructive">*</span></Label>
            <Input id="us-name" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="osh-admin-prod" required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="us-url">Base URL <span aria-hidden className="text-destructive">*</span></Label>
            <Input id="us-url" type="url" value={form.baseUrl} onChange={(e) => set('baseUrl', e.target.value)}
              placeholder="https://api.example.com" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="us-bearer">
              Bearer token{isEdit ? ' (leave blank to keep existing)' : ' *'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="us-bearer"
                type={showBearer ? 'text' : 'password'}
                value={form.bearer}
                onChange={(e) => set('bearer', e.target.value)}
                placeholder={isEdit ? '(unchanged)' : 'Bearer token…'}
                required={!isEdit}
                autoComplete="new-password"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setShowBearer((s) => !s)}>
                {showBearer ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="us-timeout">Timeout (ms)</Label>
            <Input id="us-timeout" type="number" value={form.timeoutMs}
              onChange={(e) => set('timeoutMs', e.target.value)} min={100} max={120000} />
          </div>
          <div className="flex items-center gap-2">
            <input id="us-enabled" type="checkbox" checked={form.enabled}
              onChange={(e) => set('enabled', e.target.checked)} className="size-4 rounded" />
            <Label htmlFor="us-enabled">Enabled</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !canSubmit}>
              {busy ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
