import Link from 'next/link';
import { IdentifyAsDropdown } from './identify-as-dropdown';

export function Nav() {
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold">
            OneMCP
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/profile" className="hover:text-slate-900 dark:hover:text-slate-100">
              Profile
            </Link>
          </nav>
        </div>
        <IdentifyAsDropdown />
      </div>
    </header>
  );
}
