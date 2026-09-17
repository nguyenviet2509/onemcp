'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { JsonSchemaInput } from '../shared/json-schema-input';
import {
  ToolBridge, ToolUpstream, HttpMethod,
  CreateBridgePayload, UpdateBridgePayload,
  createBridge, updateBridge,
} from '@/lib/api/tool-bridges-api';
import { ApiError } from '@/lib/api-client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget: ToolBridge | null;
  upstreams: ToolUpstream[];
  onSaved: (bridge: ToolBridge) => void;
}

interface FormState {
  name: string;
  upstreamId: string;
  description: string;
  method: HttpMethod;
  path: string;
  paramSchemaRaw: string;
  paramSchemaParsed: Record<string, unknown> | null;
  permissionId: string;
  enabled: boolean;
}

const DEFAULT_SCHEMA = '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}';

const EMPTY: FormState = {
  name: '', upstreamId: '', description: '', method: 'POST',
  path: '', paramSchemaRaw: DEFAULT_SCHEMA,
  paramSchemaParsed: { type: 'object', properties: {}, required: [] },
  permissionId: '', enabled: true,
};

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

function formFromBridge(b: ToolBridge): FormState {
  const raw = JSON.stringify(b.paramSchema, null, 2);
  return {
    name: b.name, upstreamId: b.upstreamId, description: b.description,
    method: b.method, path: b.path,
    paramSchemaRaw: raw, paramSchemaParsed: b.paramSchema as Record<string, unknown>,
    permissionId: b.permissionId, enabled: b.enabled,
  };
}

export function BridgeFormModal({ open, onOpenChange, editTarget, upstreams, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const base = editTarget ? formFromBridge(editTarget) : EMPTY;
      // Default upstream to first available if none selected
      if (!base.upstreamId && upstreams.length > 0) base.upstreamId = upstreams[0].id;
      setForm(base);
    }
  }, [open, editTarget, upstreams]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSchemaChange(raw: string, parsed: Record<string, unknown> | null) {
    setForm((prev) => ({ ...prev, paramSchemaRaw: raw, paramSchemaParsed: parsed }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.paramSchemaParsed) {
      toast.error('Fix param schema JSON before saving');
      return;
    }
    setBusy(true);
    try {
      let saved: ToolBridge;
      if (editTarget) {
        const payload: UpdateBridgePayload = {
          upstreamId: form.upstreamId,
          name: form.name.trim(),
          description: form.description.trim(),
          method: form.method,
          path: form.path.trim(),
          paramSchema: form.paramSchemaParsed,
          permissionId: form.permissionId.trim(),
          enabled: form.enabled,
        };
        saved = await updateBridge(editTarget.id, payload);
      } else {
        const payload: CreateBridgePayload = {
          upstreamId: form.upstreamId,
          name: form.name.trim(),
          description: form.description.trim(),
          method: form.method,
          path: form.path.trim(),
          paramSchema: form.paramSchemaParsed,
          permissionId: form.permissionId.trim(),
          enabled: form.enabled,
        };
        saved = await createBridge(payload);
      }
      onSaved(saved);
      onOpenChange(false);
      toast.success(editTarget ? 'Bridge updated' : 'Bridge created');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const isEdit = !!editTarget;
  const canSubmit =
    form.name.trim() && form.upstreamId && form.path.trim() &&
    form.permissionId.trim() && form.paramSchemaParsed !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit bridge' : 'New bridge'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="br-name">Name <span aria-hidden className="text-destructive">*</span></Label>
            <Input id="br-name" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="create_waf_rule" required autoFocus />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="br-upstream">Upstream <span aria-hidden className="text-destructive">*</span></Label>
            <select id="br-upstream" value={form.upstreamId}
              onChange={(e) => set('upstreamId', e.target.value)}
              className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
              required>
              {upstreams.length === 0 && <option value="">No upstreams — create one first</option>}
              {upstreams.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="br-desc">Description <span aria-hidden className="text-destructive">*</span></Label>
            <Textarea id="br-desc" value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2} placeholder="Creates a WAF rule via osh-admin API" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Method <span aria-hidden className="text-destructive">*</span></Label>
            <div className="flex gap-3">
              {HTTP_METHODS.map((m) => (
                <label key={m} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="br-method" value={m} checked={form.method === m}
                    onChange={() => set('method', m)} />
                  {m}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="br-path">Path <span aria-hidden className="text-destructive">*</span></Label>
            <Input id="br-path" value={form.path} onChange={(e) => set('path', e.target.value)}
              placeholder="/waf/rules/:rule_id" required />
            <p className="text-xs text-muted-foreground">Use :param placeholders for URL parameters</p>
          </div>

          <JsonSchemaInput
            id="br-schema"
            label="Param schema (JSON Schema)"
            value={form.paramSchemaRaw}
            onChange={handleSchemaChange}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="br-perm">Permission ID <span aria-hidden className="text-destructive">*</span></Label>
            <Input id="br-perm" value={form.permissionId}
              onChange={(e) => set('permissionId', e.target.value)}
              placeholder="onemcp:tool.create_waf_rule" required />
          </div>

          <div className="flex items-center gap-2">
            <input id="br-enabled" type="checkbox" checked={form.enabled}
              onChange={(e) => set('enabled', e.target.checked)} className="size-4 rounded" />
            <Label htmlFor="br-enabled">Enabled</Label>
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
