'use client';

import { useEffect, useState } from 'react';
import { clearIdentity, getIdentity, setIdentity } from '../lib/identity';
import { ApiError, apiFetch } from '../lib/api-client';

// "Identify as" dropdown — v1 trust-header identity picker.
// Persistent qua localStorage, gửi qua X-Onemcp-User header ở apiFetch.
//
// Post-save verification: call GET /api/users/me để catch tình huống backend
// từ chối role claim (VD username "admin" từ non-admin IP → 403 khắp nơi).
// Nếu 403 → không reload, revert identity, show inline hint để user đổi username.
export function IdentifyAsDropdown() {
  const [current, setCurrent] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setCurrent(getIdentity());
  }, []);

  async function save() {
    setError(null);
    const previous = getIdentity();
    const next = draft.trim().toLowerCase();
    if (!next) {
      setError('Username không được rỗng');
      return;
    }
    try {
      setIdentity(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid username');
      return;
    }
    // Verify backend chấp nhận identity mới (không phải role admin bị chặn CIDR).
    setVerifying(true);
    try {
      await apiFetch('/users/me');
    } catch (e) {
      // Rollback identity + show hint. Không reload trang.
      if (previous) setIdentity(previous);
      else clearIdentity();
      setVerifying(false);
      if (e instanceof ApiError && e.status === 403) {
        setError(
          `Username "${next}" không truy cập được từ IP hiện tại (role bị chặn CIDR). ` +
          'Dùng username khác (VD email @inet.vn) hoặc truy cập qua mạng nội bộ.',
        );
      } else {
        setError(e instanceof Error ? e.message : 'Verify failed');
      }
      return;
    }
    setCurrent(next);
    setEditing(false);
    setVerifying(false);
    window.location.reload();
  }

  function clear() {
    clearIdentity();
    setCurrent(null);
    window.location.reload();
  }

  if (editing || !current) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          placeholder="username"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !verifying && save()}
          disabled={verifying}
        />
        <button
          onClick={save}
          disabled={verifying}
          className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {verifying ? 'Verifying…' : 'Save'}
        </button>
        {current && !verifying && (
          <button
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className="text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        )}
        {error && (
          <span className="block w-full text-xs text-red-600 md:max-w-md">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Identified as</span>
      <code className="rounded bg-slate-100 px-2 py-0.5 font-mono dark:bg-slate-800">
        {current}
      </code>
      <button
        onClick={() => {
          setDraft(current);
          setEditing(true);
        }}
        className="text-blue-600 hover:underline"
      >
        change
      </button>
      <button onClick={clear} className="text-slate-400 hover:text-red-600">
        clear
      </button>
    </div>
  );
}
