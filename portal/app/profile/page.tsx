'use client';

import { useEffect, useState } from 'react';
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

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [identity, setIdentityLocal] = useState<string | null>(null);

  useEffect(() => {
    setIdentityLocal(getIdentity());
    apiFetch<Me>('/me')
      .then(setMe)
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Profile</h1>
      <p className="mt-1 text-sm text-slate-500">
        V1 identity mode (trust header). Full auth deferred post-v1.
      </p>

      {!identity && (
        <div className="mt-6 rounded border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
          Chưa identify. Nhập username ở navbar để bắt đầu.
        </div>
      )}

      {loading && <div className="mt-6 text-slate-500">Loading...</div>}

      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}
        </div>
      )}

      {me && (
        <dl className="mt-6 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 p-6 text-sm dark:border-slate-800">
          <dt className="text-slate-500">User ID</dt>
          <dd className="col-span-2 font-mono">{me.id}</dd>

          <dt className="text-slate-500">Username</dt>
          <dd className="col-span-2 font-mono">{me.username}</dd>

          <dt className="text-slate-500">Roles</dt>
          <dd className="col-span-2">
            {me.roles.map((r) => (
              <span
                key={r}
                className="mr-2 rounded bg-blue-100 px-2 py-0.5 font-mono text-xs text-blue-900 dark:bg-blue-950 dark:text-blue-100"
              >
                {r}
              </span>
            ))}
          </dd>

          <dt className="text-slate-500">Department</dt>
          <dd className="col-span-2 font-mono">#{me.departmentId}</dd>

          <dt className="text-slate-500">Status</dt>
          <dd className="col-span-2 font-mono">{me.status}</dd>

          <dt className="text-slate-500">Mode</dt>
          <dd className="col-span-2 font-mono text-amber-600 dark:text-amber-400">
            {me.identityMode}
          </dd>
        </dl>
      )}
    </main>
  );
}
