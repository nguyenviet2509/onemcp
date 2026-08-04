'use client';

import { useState } from 'react';
// Icons removed (icon budget: 0 outside sidebar-nav). Using text labels instead.
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('pages.apiKeys.createDialog');
  const tCommon = useTranslations('common');

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
      toast.error(e instanceof ApiError ? e.message : tCommon('unknownError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      toast.success(t('copyClipboard'));
    } catch {
      toast.error(t('copyManually'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={!created || copied}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        {!created ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-label">{t('labelField')} <span aria-hidden className="text-destructive">*</span></Label>
              <Input
                id="key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('labelPlaceholder')}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-expires">{t('expiresField')}</Label>
              <Input
                id="key-expires"
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="90"
              />
              <p className="text-xs text-muted-foreground">{t('expiresHint')}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={busy || !label.trim()}>
                {busy ? t('generating') : tCommon('create')}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <Alert variant="destructive">
              <AlertTitle>{t('storeSecurely')}</AlertTitle>
            </Alert>

            <div className="flex flex-col gap-1.5">
              <Label>{t('generatedTitle')}</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={created.key}
                  className="font-mono text-xs"
                  aria-label={t('generatedTitle')}
                />
                <Button variant="outline" size="sm" onClick={handleCopy} aria-label={tCommon('copy')}>
                  {tCommon('copy')}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} disabled={!copied}>
                {copied ? t('closeAfterCopy') : t('copyFirst')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
