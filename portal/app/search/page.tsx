'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { search, SearchHit } from '@/lib/api/search';
import { createSaved } from '@/lib/api/saved-searches';
import { listSpaces } from '@/lib/api/spaces';
import { ApiError } from '@/lib/api-client';

type SearchMode = 'hybrid' | 'fts' | 'semantic';

// Strip unsafe tags — keep <b> <i> <mark> for snippet highlighting
function sanitizeSnippet(s: string): string {
  return s.replace(/<(?!\/?(?:b|i|mark)\b)[^>]*>/gi, '');
}

function highlightTerms(text: string, q: string): string {
  if (!q.trim()) return text;
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

// Single result card
function ResultCard({ hit, q }: { hit: SearchHit; q: string }) {
  const snippetHtml = hit.snippet.includes('<b>') || hit.snippet.includes('<mark>')
    ? sanitizeSnippet(hit.snippet)
    : highlightTerms(hit.snippet, q);

  const itemLink = hit.kind === 'skill'
    ? `/skills/${encodeURIComponent(hit.name)}`
    : `/artifacts/${hit.id}`;

  const rrfScore = hit.meta?.rrfScore as number | undefined;
  const updatedAt = hit.meta?.updatedAt as string | undefined;
  const versionNo = hit.meta?.versionNo as number | undefined;

  return (
    <a
      href={itemLink}
      className="block rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-foreground">{hit.name}</span>
        {rrfScore !== undefined && (
          <span className="text-xs text-muted-foreground">
            {rrfScore.toFixed(2)}
          </span>
        )}
      </div>
      <p
        className="text-sm text-muted-foreground [&_mark]:bg-primary/15 [&_mark]:text-foreground [&_b]:font-semibold"
        dangerouslySetInnerHTML={{ __html: snippetHtml }}
      />
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">{hit.kind}</Badge>
        {hit.tags.slice(0, 2).map((t) => (
          <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
        ))}
        {hit.tags.length > 0 && <span>·</span>}
        {versionNo !== undefined && <span>v{versionNo}</span>}
        {updatedAt && <span>· {relativeTime(updatedAt)}</span>}
      </div>
    </a>
  );
}

// Active filter chips from current filter state
function FilterChips({
  mode,
  space,
  onClearSpace,
}: {
  mode: SearchMode;
  space: string;
  onClearSpace: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
      <span>Filters:</span>
      {space && (
        <button
          onClick={onClearSpace}
          className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-xs hover:bg-muted/80 transition-colors"
        >
          Space: {space} ×
        </button>
      )}
      <Badge variant="outline" className="text-xs font-normal pointer-events-none">
        Mode: {mode}
      </Badge>
    </div>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const rawMode = searchParams.get('mode');
  const [mode, setMode] = useState<SearchMode>(
    rawMode === 'fts' || rawMode === 'semantic' ? rawMode : 'hybrid'
  );
  const [space, setSpace] = useState(searchParams.get('space') ?? '');
  const [spaceCount, setSpaceCount] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Save-search dialog
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  // Load space count for subtitle — non-critical, silent failure
  useEffect(() => {
    listSpaces().then((ss) => setSpaceCount(ss.length)).catch(() => {});
  }, []);

  const runSearch = useCallback(
    async (query: string, currentMode: SearchMode, currentSpace: string) => {
      if (query.trim().length < 2) return;
      setBusy(true);
      setError(null);
      setSubmitted(true);
      const t0 = Date.now();
      try {
        const r = await search({
          q: query.trim(),
          mode: currentMode,
          space: currentSpace || undefined,
        });
        setHits(r);
        setTotalMs(Date.now() - t0);
      } catch (e) {
        setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
      } finally {
        setBusy(false);
      }
    },
    []
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set('q', q);
    params.set('mode', mode);
    if (space) params.set('space', space); else params.delete('space');
    router.replace(`?${params.toString()}`, { scroll: false });
    runSearch(q, mode, space);
  }

  async function handleSave() {
    if (!saveName.trim() || !q.trim()) return;
    setSaving(true);
    try {
      await createSaved({
        name: saveName.trim(),
        query: q.trim(),
        mode,
        filters: { spaceId: space || undefined },
      });
      toast.success('Search saved');
      setSaveOpen(false);
      setSaveName('');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to save search');
    } finally {
      setSaving(false);
    }
  }

  // Use spaces count as proxy for "total artifacts" subtitle — best effort
  const totalLabel = spaceCount > 0 ? `${spaceCount}+ spaces` : 'all';

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      {/* Center header */}
      <div className="text-center mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground mb-1">Search OneMCP</h1>
        <p className="text-sm text-muted-foreground">
          Hybrid semantic + keyword search across {totalLabel}
        </p>
      </div>

      {/* Search input */}
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask anything…"
            autoFocus
            className="w-full rounded-lg border border-border bg-card py-3 pl-12 pr-16 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-foreground transition-colors"
          />
          {/* Search glyph — vertically centered; text-2xl matches input text scale */}
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl leading-none text-muted-foreground select-none">
            ⌕
          </span>
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs leading-none text-muted-foreground">
            Enter
          </kbd>
        </div>

        <FilterChips
          mode={mode}
          space={space}
          onClearSpace={() => { setSpace(''); }}
        />
      </form>

      {/* Mode selector — compact text buttons below filter row */}
      <div className="flex items-center gap-1 mt-3 text-xs">
        {(['hybrid', 'fts', 'semantic'] as SearchMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); if (submitted && q.trim().length >= 2) runSearch(q, m, space); }}
            className={`rounded px-2 py-0.5 transition-colors ${
              mode === m
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results area */}
      <div className="mt-8">
        {busy && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        )}

        {submitted && !busy && hits.length === 0 && !error && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No results found. Try different terms or switch mode.
          </p>
        )}

        {!busy && hits.length > 0 && (
          <>
            {/* Result meta line */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">
                {hits.length} result{hits.length !== 1 ? 's' : ''}
                {totalMs !== null && ` · ${totalMs}ms`}
                {` · ${mode} mode`}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSaveOpen(true)}
              >
                Save search
              </Button>
            </div>

            <ul className="space-y-3">
              {hits.map((h) => (
                <li key={`${h.kind}-${h.id}`}>
                  <ResultCard hit={h} q={q} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Save search dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this search</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label htmlFor="save-name">Name</Label>
            <Input
              id="save-name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Payment webhook issues"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving || !saveName.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-6 py-10"><Skeleton className="h-48 w-full" /></div>}>
      <SearchPageInner />
    </Suspense>
  );
}
