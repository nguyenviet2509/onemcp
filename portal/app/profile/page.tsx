'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiFetch, ApiError } from '../../lib/api-client';
import { getIdentity } from '../../lib/identity';

interface Me {
  id: number;
  username: string;
  roles: string[];
  departmentId: number;
  status: string;
  identityMode: string;
}

// Option A profile page: PageShell-style layout, tokens only — no hardcoded colors.
export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [identity, setIdentityLocal] = useState<string | null>(null);
  const t = useTranslations('pages.profile');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');

  useEffect(() => {
    setIdentityLocal(getIdentity());
    apiFetch<Me>('/me')
      .then(setMe)
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-8 py-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Identity warning */}
      {!identity && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {t('notIdentified')}
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {me && (
        <div className="mb-4">
          <Link
            href="/profile/api-keys"
            className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {tNav('apiKeys')} →
          </Link>
        </div>
      )}

      {/* Profile detail — Option A: clean dl table, border-border, no card shadow */}
      {me && (
        <div className="rounded-lg border border-border">
          <dl className="divide-y divide-border text-sm">
            <ProfileRow label={t('fields.userId')}   value={<span className="font-mono">{me.id}</span>} />
            <ProfileRow label={t('fields.username')}  value={<span className="font-mono">{me.username}</span>} />
            <ProfileRow label={t('fields.roles')}     value={
              <div className="flex flex-wrap gap-1">
                {me.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded border border-border bg-muted px-2 py-px font-mono text-[11px] font-medium text-muted-foreground"
                  >
                    {r}
                  </span>
                ))}
              </div>
            } />
            <ProfileRow label={t('fields.department')} value={<span className="font-mono">#{me.departmentId}</span>} />
            <ProfileRow label={t('fields.status')}     value={<span className="font-mono">{me.status}</span>} />
            <ProfileRow label={t('fields.mode')}       value={
              <span className="font-mono text-amber-600 dark:text-amber-400">{me.identityMode}</span>
            } />
          </dl>
        </div>
      )}
    </main>
  );
}

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2">{value}</dd>
    </div>
  );
}
