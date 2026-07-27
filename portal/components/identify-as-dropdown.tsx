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
//
// Layout: vertical stack trong Card wrapper để tránh overflow ở sidebar 240px.
// TODO(sso): replace với UserMenu khi SSO ships.
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
          `"${next}" không truy cập được từ IP hiện tại. Dùng email @inet.vn hoặc mạng nội bộ.`,
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

  // Edit / no-identity form
  if (editing || !current) {
    return (
      <div className="rounded-lg border border-sidebar-border bg-sidebar p-2.5 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Identity
        </p>
        <input
          className="w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="username"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !verifying && save()}
          disabled={verifying}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={verifying}
            className="rounded border border-foreground bg-foreground px-2.5 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {verifying ? 'Checking…' : 'Save'}
          </button>
          {current && !verifying && (
            <button
              onClick={() => { setEditing(false); setError(null); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
        {error && (
          <p className="text-[10px] text-destructive leading-tight">{error}</p>
        )}
      </div>
    );
  }

  // Identity set — compact display row
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar p-2.5 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Identity
      </p>
      <div className="flex items-center justify-between gap-2">
        <code className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-foreground">
          {current}
        </code>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => { setDraft(current); setEditing(true); }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            change
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button
            onClick={clear}
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          >
            clear
          </button>
        </div>
      </div>
    </div>
  );
}
