import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from './config';

// Server-side locale resolver for next-intl. Reads NEXT_LOCALE cookie,
// falls back to DEFAULT_LOCALE ('vi'). No URL routing — the current path
// is unchanged; switching locale rewrites the cookie and reloads.
export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return { locale, messages };
});
