'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api-client';
import {
  approveSkillVersion,
  getSkill,
  listSkillVersions,
  rejectSkillVersion,
  Skill,
  SkillVersion,
} from '@/lib/api/skills';

interface Props {
  params: Promise<{ name: string }>;
}

// Option A skill detail: token-only colors, divide-y tables, chip status badges.
export default function SkillDetailPage({ params }: Props) {
  const { name } = use(params);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const t = useTranslations('pages.skillsDetail');
  const tSkills = useTranslations('pages.skills');
  const tCommon = useTranslations('common');
  const tReview = useTranslations('pages.artifactsReviewActions');

  const reload = () =>
    Promise.all([getSkill(name), listSkillVersions(name)])
      .then(([s, vs]) => { setSkill(s); setVersions(vs); })
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)));

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function handleApprove(id: number) {
    setBusyId(id); setError(null);
    try { await approveSkillVersion(name, id); await reload(); }
    catch (e) { setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)); }
    finally { setBusyId(null); }
  }

  async function handleReject(id: number) {
    setBusyId(id); setError(null);
    try { await rejectSkillVersion(name, id); await reload(); }
    catch (e) { setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)); }
    finally { setBusyId(null); }
  }

  return (
    <main className="mx-auto max-w-5xl px-8 py-6">
      {/* Breadcrumb */}
      <div className="mb-4 text-xs text-muted-foreground">
        <Link href="/skills" className="hover:text-foreground transition-colors">
          ← {tSkills('title')}
        </Link>
      </div>

      {loading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {skill && (
        <>
          {/* Header */}
          <div className="mb-6 flex items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{skill.name}</h1>
            <StatusChip status={skill.status} />
          </div>

          {skill.description && (
            <p className="mb-4 text-sm text-muted-foreground">{skill.description}</p>
          )}

          {/* Metadata table */}
          <div className="rounded-lg border border-border">
            <dl className="divide-y divide-border text-sm">
              <MetaRow label="Repository">
                <a href={skill.repoUrl} target="_blank" rel="noreferrer"
                  className="font-mono text-xs text-primary hover:underline break-all">
                  {skill.repoUrl}
                </a>
              </MetaRow>
              <MetaRow label="Department">
                <span className="font-mono">#{skill.departmentId}</span>
              </MetaRow>
              <MetaRow label="Tags">
                {skill.tags.length === 0 ? (
                  <em className="text-muted-foreground/60">none</em>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {skill.tags.map((t) => (
                      <span key={t} className="rounded border border-border bg-muted px-2 py-px font-mono text-[11px] text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </MetaRow>
              <MetaRow label="Current version">
                <span className="font-mono">
                  {skill.currentVersionId ? `#${skill.currentVersionId}` : <em className="text-muted-foreground/60">none</em>}
                </span>
              </MetaRow>
            </dl>
          </div>

          {/* Version history */}
          <section className="mt-8">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('versionHistory')}
            </h2>
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noVersions')}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">{t('columns.version')}</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">{t('columns.commit')}</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">{t('columns.status')}</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">{t('columns.approvedAt')}</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">{t('columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {versions.map((v) => (
                      <tr
                        key={v.id}
                        className={v.id === skill.currentVersionId ? 'bg-primary/5' : 'hover:bg-muted/50'}
                      >
                        <td className="px-4 py-2.5 font-mono">{v.version ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{v.commitSha.slice(0, 8)}</td>
                        <td className="px-4 py-2.5"><StatusChip status={v.status} /></td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {v.approvedAt ? new Date(v.approvedAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          {v.status === 'pending' ? (
                            <div className="flex gap-2">
                              <button
                                disabled={busyId === v.id}
                                onClick={() => handleApprove(v.id)}
                                className="rounded border border-foreground bg-foreground px-2 py-px text-[11px] font-medium text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
                              >
                                {tReview('approve')}
                              </button>
                              <button
                                disabled={busyId === v.id}
                                onClick={() => handleReject(v.id)}
                                className="rounded border border-destructive/50 bg-destructive/10 px-2 py-px text-[11px] font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                              >
                                {tReview('reject')}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2">{children}</dd>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls = status === 'active'
    ? 'border-transparent bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
    : status === 'rejected'
      ? 'border-transparent bg-destructive/10 text-destructive'
      : status === 'pending'
        ? 'border-transparent bg-amber-500/12 text-amber-600 dark:text-amber-400'
        : 'border-border bg-muted text-muted-foreground';
  return (
    <span className={`rounded border px-2 py-px text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  );
}
