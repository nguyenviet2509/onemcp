'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { PageShell } from '@/components/page-shell';
import { EmptyState } from '@/components/empty-state';
import { ApiKeyCreateDialog } from '@/components/api-key-create-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { listMyKeys, revokeKey, ApiKey, ApiKeyCreated } from '@/lib/api/api-keys';
import { ApiError } from '@/lib/api-client';

function relativeTime(date: string | null): string {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return date;
  }
}

function isExpired(key: ApiKey): boolean {
  if (!key.expiresAt) return false;
  return new Date(key.expiresAt) < new Date();
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);
  const t = useTranslations('pages.apiKeys');
  const tCommon = useTranslations('common');

  useEffect(() => {
    listMyKeys()
      .then(setKeys)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(created: ApiKeyCreated) {
    // Add the new key (without full key value) to the list.
    const { key: _key, ...rest } = created;
    setKeys((prev) => [rest, ...prev]);
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeKey(revokeTarget.id);
      setKeys((prev) => prev.filter((k) => k.id !== revokeTarget.id));
      toast.success(t('toasts.revoked'));
      setRevokeTarget(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('toasts.revokeFailed'));
    } finally {
      setRevoking(false);
    }
  }

  const actions = (
    <Button onClick={() => setCreateOpen(true)}>{t('generate')}</Button>
  );

  return (
    <PageShell
      title={t('title')}
      breadcrumb={[{ label: t('breadcrumbProfile'), href: '/profile' }, { label: t('title') }]}
      actions={actions}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      )}

      {!loading && !error && keys.length === 0 && (
        <EmptyState
          title={t('empty')}
          description={t('emptyDescription')}
          cta={<Button onClick={() => setCreateOpen(true)}>{t('generate')}</Button>}
        />
      )}

      {!loading && keys.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('columns.label')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('columns.prefix')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('columns.lastUsed')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('columns.expires')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('columns.status')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((k) => {
                const expired = isExpired(k);
                return (
                  <tr key={k.id} className="bg-card hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{k.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {k.prefix}…
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {relativeTime(k.lastUsedAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {k.expiresAt ? relativeTime(k.expiresAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={expired ? 'destructive' : 'secondary'}>
                        {expired ? t('statusExpired') : t('statusActive')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setRevokeTarget(k)}
                      >
                        {tCommon('revoke')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ApiKeyCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      {/* Revoke confirm dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('confirmRevoke')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('revokeWarning', { label: revokeTarget?.label ?? '' })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={revoking}>
              {tCommon('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? tCommon('loading') : tCommon('revoke')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
