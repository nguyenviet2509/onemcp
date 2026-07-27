'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ApiError, apiFetch } from '@/lib/api-client';
import { clearIdentity, getIdentity, setIdentity } from '@/lib/identity';

// Bottom-of-sidebar user pill: avatar + name + subtitle + ⋯ dropdown.
// Dropdown consolidates identity actions AND theme toggle (moved out of the
// sidebar footer so bottom row stays single-line per Option A mockup).
export function SidebarUserCard() {
  const [current, setCurrent] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCurrent(getIdentity());
    setMounted(true);
  }, []);

  async function save() {
    setError(null);
    const previous = getIdentity();
    const next = draft.trim().toLowerCase();
    if (!next) return setError('Username không được rỗng');
    try {
      setIdentity(next);
    } catch (e) {
      return setError(e instanceof Error ? e.message : 'Invalid username');
    }
    setVerifying(true);
    try {
      await apiFetch('/users/me');
    } catch (e) {
      if (previous) setIdentity(previous);
      else clearIdentity();
      setVerifying(false);
      if (e instanceof ApiError && e.status === 403) {
        return setError(
          `"${next}" không truy cập được từ IP hiện tại. Dùng email @inet.vn hoặc mạng nội bộ.`,
        );
      }
      return setError(e instanceof Error ? e.message : 'Verify failed');
    }
    setCurrent(next);
    setEditing(false);
    setVerifying(false);
    window.location.reload();
  }

  function onClear() {
    clearIdentity();
    setCurrent(null);
    window.location.reload();
  }

  // Inline edit mode — replaces the pill with a compact input row.
  if (editing) {
    return (
      <div className="border-t border-sidebar-border/70 px-3 py-2 space-y-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !verifying) save();
            if (e.key === 'Escape') { setEditing(false); setError(null); }
          }}
          disabled={verifying}
          placeholder="username"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={verifying}
            className="rounded-md border border-foreground bg-foreground px-2 py-0.5 text-[11px] text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {verifying ? 'Checking…' : 'Save'}
          </button>
          <button
            onClick={() => { setEditing(false); setError(null); }}
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-[10px] leading-tight text-destructive">{error}</p>}
      </div>
    );
  }

  const initials = current ? current.slice(0, 2).toUpperCase() : '··';
  const name = current ?? 'Sign in';
  const subtitle = current ? 'Signed in' : 'Not signed in';
  const currentTheme = (mounted && theme) || 'system';

  return (
    <div className="flex items-center gap-2.5 border-t border-sidebar-border/70 px-3 py-2">
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold uppercase text-foreground"
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[12px] font-medium text-foreground">{name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open user menu"
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {/* Text ellipsis — reuses existing icon budget (0 new lucide icons) */}
          <span aria-hidden className="text-base leading-none tracking-tighter">···</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" sideOffset={6} className="w-52">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Identity
          </DropdownMenuLabel>
          {current ? (
            <>
              <DropdownMenuItem onClick={() => { setDraft(current); setEditing(true); }}>
                Change identity…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClear} className="text-destructive focus:text-destructive">
                Clear identity
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={() => { setDraft(''); setEditing(true); }}>
              Sign in…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Theme
          </DropdownMenuLabel>
          {/* Plain items avoid RadioGroup runtime crash with next-themes SSR */}
          {(['light', 'dark', 'system'] as const).map((t) => (
            <DropdownMenuItem key={t} onClick={() => setTheme(t)}>
              {mounted && currentTheme === t ? '✓ ' : ''}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
