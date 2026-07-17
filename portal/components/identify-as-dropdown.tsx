'use client';

import { useEffect, useState } from 'react';
import { clearIdentity, getIdentity, setIdentity } from '../lib/identity';

// "Identify as" dropdown — v1 trust-header identity picker.
// Persistent qua localStorage, gửi qua X-Onemcp-User header ở apiFetch.
export function IdentifyAsDropdown() {
  const [current, setCurrent] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(getIdentity());
  }, []);

  function save() {
    try {
      setIdentity(draft);
      setCurrent(draft.trim().toLowerCase());
      setEditing(false);
      setError(null);
      // Reload để cho fresh /me + navbar re-fetch role.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid username');
    }
  }

  function clear() {
    clearIdentity();
    setCurrent(null);
    window.location.reload();
  }

  if (editing || !current) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <input
          className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          placeholder="username"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button
          onClick={save}
          className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
        >
          Save
        </button>
        {current && (
          <button
            onClick={() => setEditing(false)}
            className="text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
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
