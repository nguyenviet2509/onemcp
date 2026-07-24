'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { listSpaces, type Space } from '../lib/api/spaces';
import { useCurrentSpace } from '../lib/space-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Space switcher — shows current space, lets user pick from list.
// Persists to localStorage + URL param ?space=<slug>.
// URL is source of truth; localStorage is a fallback for direct navigation.
export function SpaceSwitcher() {
  const [spaces, setSpaces] = useState<Space[]>([]);
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

    // Sync URL param
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set('space', next.slug);
    } else {
      params.delete('space');
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  const label = space.slug
    ? (space.name ?? space.slug)
    : 'All spaces';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-sm text-foreground shadow-sm transition-colors hover:bg-muted"
        aria-label="Switch space"
      >
        {/* Space label — text only, no icon to preserve icon budget */}
        <span className="max-w-[120px] truncate font-medium">{label}</span>
        {space.slug && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono text-primary">
            {space.slug}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[180px]">
        {/* "All spaces" option */}
        <DropdownMenuItem onSelect={() => select(null)} className="flex items-center justify-between">
          <span>All spaces</span>
          {space.slug === null && (
            <span className="ml-auto text-xs text-primary">selected</span>
          )}
        </DropdownMenuItem>

        {spaces.length > 0 && <DropdownMenuSeparator />}

        {spaces.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onSelect={() => select(s)}
            className="flex items-center gap-2"
          >
            <span className="flex-1 truncate">{s.name}</span>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {s.slug}
            </span>
            {space.slug === s.slug && (
              <span className="shrink-0 text-xs text-primary">selected</span>
            )}
          </DropdownMenuItem>
        ))}

        {spaces.length === 0 && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            No spaces yet
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
