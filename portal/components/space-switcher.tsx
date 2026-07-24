'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { listSpaces, type Space } from '../lib/api/spaces';
import { useCurrentSpace } from '../lib/space-context';

// Space switcher — shows current space, lets user pick from list.
// Persists to localStorage + URL param ?space=<slug>.
// URL is source of truth; localStorage is a fallback for direct navigation.
export function SpaceSwitcher() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const { space, setSpace } = useCurrentSpace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    listSpaces()
      .then(setSpaces)
      .catch(() => setSpaces([]));
  }, []);

  function select(next: Space | null) {
    const newSpace = next ? { slug: next.slug, name: next.name } : { slug: null };
    setSpace(newSpace);
    setOpen(false);

    // Sync URL param
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set('space', next.slug);
      } else {
        params.delete('space');
      }
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ''}`);
    });
  }

  const label = space.slug
    ? (space.name ?? space.slug)
    : 'All spaces';

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-md border border-secondary-200 bg-white px-2.5 py-1 text-sm text-secondary-700 shadow-sm transition-colors hover:bg-secondary-50 dark:border-secondary-700 dark:bg-secondary-900 dark:text-secondary-300 dark:hover:bg-secondary-800"
          aria-label="Switch space"
        >
          {/* Space label — text only, no icon to preserve icon budget */}
          <span className="max-w-[120px] truncate font-medium">{label}</span>
          {space.slug && (
            <span className="rounded bg-primary-100 px-1.5 py-0.5 text-xs font-mono text-primary-700 dark:bg-primary-900 dark:text-primary-300">
              {space.slug}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-secondary-400" aria-hidden />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[180px] rounded-lg border border-secondary-200 bg-white p-1 shadow-dropdown dark:border-secondary-700 dark:bg-secondary-900"
        >
          {/* "All spaces" option */}
          <DropdownMenu.Item
            onSelect={() => select(null)}
            className="flex cursor-pointer items-center rounded px-3 py-1.5 text-sm text-secondary-700 outline-none hover:bg-secondary-100 data-[highlighted]:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-800 dark:data-[highlighted]:bg-secondary-800"
          >
            All spaces
            {space.slug === null && (
              <span className="ml-auto text-xs text-primary-600">selected</span>
            )}
          </DropdownMenu.Item>

          {spaces.length > 0 && (
            <DropdownMenu.Separator className="my-1 h-px bg-secondary-100 dark:bg-secondary-800" />
          )}

          {spaces.map((s) => (
            <DropdownMenu.Item
              key={s.id}
              onSelect={() => select(s)}
              className="flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-sm text-secondary-700 outline-none hover:bg-secondary-100 data-[highlighted]:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-800 dark:data-[highlighted]:bg-secondary-800"
            >
              <span className="flex-1 truncate">{s.name}</span>
              <span className="shrink-0 rounded bg-secondary-100 px-1.5 py-0.5 font-mono text-xs text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400">
                {s.slug}
              </span>
              {space.slug === s.slug && (
                <span className="shrink-0 text-xs text-primary-600">selected</span>
              )}
            </DropdownMenu.Item>
          ))}

          {spaces.length === 0 && (
            <DropdownMenu.Item
              disabled
              className="px-3 py-1.5 text-xs text-secondary-400 dark:text-secondary-600"
            >
              No spaces yet
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
