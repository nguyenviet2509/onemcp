'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, isLocale } from '../i18n/config';

// Server action — writes NEXT_LOCALE cookie so next-intl picks up the new
// locale on the next server render. Called from the sidebar language
// switcher. 1 year cookie lifetime; matches next-intl default guidance.
export async function setLocaleCookie(next: string): Promise<void> {
  if (!isLocale(next)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}
