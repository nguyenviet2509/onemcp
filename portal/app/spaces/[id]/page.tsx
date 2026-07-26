'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getSpace, updateSpace, Space } from '@/lib/api/spaces';
import { ApiError } from '@/lib/api-client';

export default function SpaceEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // id param is the space id; fetch by slug if backend supports it,
    // else use id directly. getSpace accepts slug — pass id as-is (slug == id in list).
    getSpace(id)
      .then((s) => {
        setSpace(s);
        setName(s.name);
        setDescription(s.description ?? '');
        setIsPublic(s.isPublic);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!space) return;
    setBusy(true);
    try {
      await updateSpace(space.slug, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        isPublic,
      });
      toast.success('Space updated');
      router.push('/spaces');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Edit space"
      breadcrumb={[
        { label: 'Spaces', href: '/spaces' },
        { label: space?.name ?? id },
      ]}
    >
      {loading && (
        <div className="space-y-4 max-w-lg">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-48" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && space && (
        <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-slug">Slug</Label>
            <Input
              id="edit-slug"
              value={space.slug}
              disabled
              className="font-mono text-xs opacity-70"
              aria-describedby="slug-hint"
            />
            <p id="slug-hint" className="text-xs text-muted-foreground">
              Slug cannot be changed after creation.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-desc">Description</Label>
            <Input
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Public (visible to all authenticated users)
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/spaces')}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </PageShell>
  );
}
