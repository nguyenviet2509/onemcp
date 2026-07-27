'use client';

import { useState } from 'react';
// Icons removed (icon budget: 0 outside sidebar-nav). Using text labels instead.
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { createKey, ApiKeyCreated } from '@/lib/api/api-keys';
import { ApiError } from '@/lib/api-client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: ApiKeyCreated) => void;
}

export function ApiKeyCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('90');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);

  function handleClose() {
    if (created && !copied) return; // force copy first
    setLabel('');
    setExpiresInDays('90');
    setCreated(null);
    setCopied(false);
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    try {
      const days = parseInt(expiresInDays, 10);
      const result = await createKey({
        label: label.trim(),
        expiresInDays: Number.isFinite(days) && days > 0 ? days : undefined,
      });
      setCreated(result);
      onCreated(result);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to create key');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      toast.success('Key copied to clipboard');
    } catch {
      toast.error('Copy failed — please copy manually');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={!created || copied}>
        <DialogHeader>
          <DialogTitle>Generate API key</DialogTitle>
        </DialogHeader>

        {!created ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-label">Label <span aria-hidden className="text-destructive">*</span></Label>
              <Input
                id="key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. CI pipeline, local dev"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-expires">Expires in (days)</Label>
              <Input
                id="key-expires"
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="90"
              />
              <p className="text-xs text-muted-foreground">Leave blank or 0 for no expiry. Max 365.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !label.trim()}>
                {busy ? 'Generating…' : 'Generate'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <Alert variant="destructive">
              <AlertTitle>Copy now — this key will not be shown again</AlertTitle>
              <AlertDescription>
                Store it securely. Once you close this dialog the full key is gone.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-1.5">
              <Label>Your new API key</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={created.key}
                  className="font-mono text-xs"
                  aria-label="Full API key value"
                />
                <Button variant="outline" size="sm" onClick={handleCopy} aria-label="Copy key">
                  Copy
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} disabled={!copied}>
                {copied ? "I've copied it — close" : "Copy the key above first"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
