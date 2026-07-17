'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { ApiError } from '../../../lib/api-client';
import {
  approveSkillVersion,
  getSkill,
  listSkillVersions,
  rejectSkillVersion,
  Skill,
  SkillVersion,
} from '../../../lib/api/skills';

interface Props {
  params: Promise<{ name: string }>;
}

export default function SkillDetailPage({ params }: Props) {
  const { name } = use(params);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = () =>
    Promise.all([getSkill(name), listSkillVersions(name)])
      .then(([s, vs]) => {
        setSkill(s);
        setVersions(vs);
      })
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)));

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function handleApprove(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await approveSkillVersion(name, id);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await rejectSkillVersion(name, id);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="text-sm">
        <Link href="/skills" className="text-blue-600 hover:underline">
          ← All skills
        </Link>
      </div>

      {loading && <p className="mt-6 text-slate-500">Loading...</p>}
      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}
        </div>
      )}

      {skill && (
        <>
          <div className="mt-4">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-bold">{skill.name}</h1>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  skill.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {skill.status}
              </span>
            </div>
            <p className="mt-2 text-slate-700 dark:text-slate-300">
              {skill.description ?? <em className="text-slate-400">no description</em>}
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 p-6 text-sm dark:border-slate-800">
            <dt className="text-slate-500">Repository</dt>
            <dd className="col-span-2 font-mono text-xs break-all">
              <a href={skill.repoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                {skill.repoUrl}
              </a>
            </dd>

            <dt className="text-slate-500">Department</dt>
            <dd className="col-span-2 font-mono">#{skill.departmentId}</dd>

            <dt className="text-slate-500">Tags</dt>
            <dd className="col-span-2">
              {skill.tags.length === 0 ? (
                <em className="text-slate-400">none</em>
              ) : (
                skill.tags.map((t) => (
                  <span
                    key={t}
                    className="mr-2 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {t}
                  </span>
                ))
              )}
            </dd>

            <dt className="text-slate-500">Current version</dt>
            <dd className="col-span-2 font-mono">
              {skill.currentVersionId ? `#${skill.currentVersionId}` : <em className="text-slate-400">none</em>}
            </dd>
          </dl>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Version history</h2>
            {versions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Chưa có version nào.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
                  <tr>
                    <th className="py-2">Version</th>
                    <th>Commit</th>
                    <th>Status</th>
                    <th>Approved at</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr
                      key={v.id}
                      className={`border-b border-slate-100 dark:border-slate-800 ${
                        v.id === skill.currentVersionId
                          ? 'bg-blue-50 dark:bg-blue-950'
                          : ''
                      }`}
                    >
                      <td className="py-2 font-mono">{v.version ?? '—'}</td>
                      <td className="font-mono text-xs text-slate-500">{v.commitSha.slice(0, 8)}</td>
                      <td>
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            v.status === 'active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100'
                              : v.status === 'rejected'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100'
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="text-slate-500">
                        {v.approvedAt ? new Date(v.approvedAt).toLocaleString() : '—'}
                      </td>
                      <td>
                        {v.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button
                              disabled={busyId === v.id}
                              onClick={() => handleApprove(v.id)}
                              className="rounded bg-green-600 px-2 py-0.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              approve
                            </button>
                            <button
                              disabled={busyId === v.id}
                              onClick={() => handleReject(v.id)}
                              className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}
