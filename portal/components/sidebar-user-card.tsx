'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { apiFetch } from '@/lib/api-client';
import { setLocaleCookie } from '@/lib/i18n-actions';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/config';

interface MeResponse {
  id: number;
  username: string;
  roles: string[];
  departmentId: number;
  status: string;
  identityMode: string;
}

// Bottom-of-sidebar user pill: avatar + name + ⋯ dropdown.
// User info fetched from /api/me (SSO — oauth2-proxy injects X-Onemcp-User from Zitadel LDAP).
// Sign-out delegates to oauth2-proxy endpoint — clears proxy session cookie.
export function SidebarUserCard() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const locale = useLocale() as Locale;
  const t = useTranslations('sidebar');
  const tCommon = useTranslations('common');
  const [, startLocaleTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    apiFetch<MeResponse>('/me')
      .then(setMe)
      .catch(() => {
        // 401 = not authenticated; api-client handles redirect to sign-in page.
        // Other errors: silently fall through — display defaults (no username).
      });
  }, []);

  const username = me?.username ?? null;
  const initials = username ? username.slice(0, 2).toUpperCase() : '··';
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
        <div className="truncate text-xs font-medium text-foreground">
          {username ?? tCommon('signIn')}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {username ? tCommon('signedIn') : tCommon('notSignedIn')}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open user menu"
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span aria-hidden className="text-base leading-none tracking-tighter">···</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" sideOffset={6} className="w-52">
          {/* Theme section */}
          <div className="px-1.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('theme')}
          </div>
          {(['light', 'dark', 'system'] as const).map((th) => (
            <DropdownMenuItem
              key={th}
              className="flex items-center justify-between"
              render={<button type="button" onClick={() => setTheme(th)} />}
            >
              <span>{t(`themes.${th}`)}</span>
              {mounted && currentTheme === th && (
                <span className="text-xs text-muted-foreground" aria-hidden>✓</span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* Language section */}
          <div className="px-1.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('language')}
          </div>
          {LOCALES.map((lc) => (
            <DropdownMenuItem
              key={lc}
              className="flex items-center justify-between"
              render={<button type="button" onClick={() => startLocaleTransition(() => setLocaleCookie(lc))} />}
            >
              <span>{LOCALE_LABELS[lc]}</span>
              {locale === lc && (
                <span className="text-xs text-muted-foreground" aria-hidden>✓</span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* Sign out — delegates to oauth2-proxy; clears proxy session cookie. */}
          <DropdownMenuItem render={<a href="/oauth2/sign_out?rd=/" />}>
            <LogOut className="mr-2 size-3.5 shrink-0" aria-hidden />
            <span>{tCommon('signOut')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
