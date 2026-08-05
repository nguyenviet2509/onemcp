'use client';

import { LogOut, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/lib/auth';

// UserMenu — sidebar bottom pill and nav bar user component.
// Shows authenticated SSO user (displayName / email) + Logout dropdown item.
// Always rendered — portal is SSO-only, no env gate.
export function UserMenu() {
  const user = useCurrentUser();

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // Proceed to redirect regardless of network error — cookie may be cleared server-side.
    }
    window.location.href = '/login';
  }

  // Initials for avatar — first 2 chars of username or email prefix.
  const initials = user
    ? (user.username ?? user.email?.split('@')[0] ?? '?').slice(0, 2).toUpperCase()
    : '··';

  const subtitle = user?.email ?? user?.username ?? '…';

  return (
    <div className="flex items-center gap-2.5 border-t border-sidebar-border/70 px-3 py-2">
      {/* Avatar circle */}
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold uppercase text-foreground"
      >
        {initials}
      </span>

      {/* Name + subtitle */}
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-xs font-medium text-foreground">
          {user?.displayName ?? user?.username ?? '…'}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {subtitle}
        </div>
      </div>

      {/* Ellipsis trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open user menu"
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span aria-hidden className="text-base leading-none tracking-tighter">···</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" sideOffset={6} className="w-52">
          {/* User info label */}
          <div className="px-1.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Account
          </div>
          {user && (
            <div className="flex items-center gap-1.5 px-1.5 py-1">
              <User className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs text-foreground">{user.email ?? user.username}</span>
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            render={<button type="button" onClick={handleLogout} />}
          >
            <LogOut className="size-3.5" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
