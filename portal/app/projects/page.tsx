'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '../../lib/api-client';
import {
  approveProject,
  createProject,
  listProjects,
  Project,
  ProjectScope,
  regenerateSecret,
  rejectProject,
  suspendProject,
} from '../../lib/api/projects';

interface Me {
  id: number;
  username: string;
  roles: string[];
}

// P12+P13: minimal projects console. List + register + admin actions + regen secret.
export default function ProjectsPage() {
  const [items, setItems] = useState<Project[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freshSecret, setFreshSecret] = useState<{ id: number; secret: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const isAdmin = me?.roles.some((r) => r === 'super-admin' || r === 'dept-admin') ?? false;

  const refresh = () => {
    setLoading(true);
    listProjects()
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe(null));
    refresh();
  }, []);

  const onCreate = async (payload: {
    slug: string;
    name: string;
    gitRepoUrl: string;
    scope: ProjectScope;
    description?: string;
  }) => {
    try {
      const { project, webhookSecret } = await createProject(payload);
      setItems((prev) => [project, ...prev]);
      setFreshSecret({ id: project.id, secret: webhookSecret });
      setShowForm(false);
    } catch (e) {
      alert(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    }
  };

  const onApprove = async (id: number) => {
    try {
      await approveProject(id);
      refresh();
    } catch (e) {
      alert(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    }
  };

  const onReject = async (id: number) => {
    const reason = prompt('Reason (optional):') ?? undefined;
    try {
      await rejectProject(id, reason);
      refresh();
    } catch (e) {
      alert(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    }
  };

  const onSuspend = async (id: number) => {
    if (!confirm('Suspend this project? Sync will stop.')) return;
    try {
      await suspendProject(id);
      refresh();
    } catch (e) {
      alert(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    }
  };

  const onRegen = async (id: number) => {
    if (!confirm('Rotate webhook secret? Old secret becomes invalid immediately.')) return;
    try {
      const { webhookSecret } = await regenerateSecret(id);
      setFreshSecret({ id, secret: webhookSecret });
    } catch (e) {
      alert(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    }
  };

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Register new project'}
        </button>
      </div>

      {showForm && <RegisterForm onSubmit={onCreate} />}

      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      {loading && <div className="text-slate-500 text-sm">Loading…</div>}

      <div className="border rounded divide-y">
        <div className="grid grid-cols-[1fr,2fr,80px,90px,90px,auto] gap-3 px-3 py-2 text-xs font-medium text-slate-500 bg-slate-50">
          <div>Slug</div>
          <div>Name / Repo</div>
          <div>Scope</div>
          <div>Status</div>
          <div>Owner</div>
          <div>Actions</div>
        </div>
        {items.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[1fr,2fr,80px,90px,90px,auto] gap-3 px-3 py-2 text-sm items-center"
          >
            <div className="font-mono">{p.slug}</div>
            <div>
              <div>{p.name}</div>
              <div className="text-xs text-slate-500 truncate">{p.gitRepoUrl}</div>
            </div>
            <div>{p.scope}</div>
            <div>
              <StatusPill status={p.status} />
            </div>
            <div className="text-xs">#{p.ownerId ?? '—'}</div>
            <div className="flex gap-1 flex-wrap">
              {isAdmin && p.status === 'pending' && (
                <>
                  <ActionBtn onClick={() => onApprove(p.id)} variant="ok">Approve</ActionBtn>
                  <ActionBtn onClick={() => onReject(p.id)} variant="bad">Reject</ActionBtn>
                </>
              )}
              {isAdmin && (p.status === 'active' || p.status === 'approved') && (
                <ActionBtn onClick={() => onSuspend(p.id)} variant="warn">Suspend</ActionBtn>
              )}
              {(isAdmin || p.ownerId === me?.id) && (
                <ActionBtn onClick={() => onRegen(p.id)} variant="neutral">Regen secret</ActionBtn>
              )}
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="px-3 py-6 text-sm text-slate-500 text-center">No projects yet.</div>
        )}
      </div>

      {freshSecret && (
        <SecretModal
          projectId={freshSecret.id}
          secret={freshSecret.secret}
          onClose={() => setFreshSecret(null)}
        />
      )}
    </div>
  );
}

function RegisterForm({
  onSubmit,
}: {
  onSubmit: (p: { slug: string; name: string; gitRepoUrl: string; scope: ProjectScope; description?: string }) => void;
}) {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [scope, setScope] = useState<ProjectScope>('private');
  const [description, setDescription] = useState('');

  const handle = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ slug: slug.trim(), name: name.trim(), gitRepoUrl: gitRepoUrl.trim(), scope, description: description.trim() || undefined });
  };

  return (
    <form onSubmit={handle} className="border rounded p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
      <label className="flex flex-col">
        <span className="text-xs text-slate-500">Slug (kebab-case)</span>
        <input required pattern="[a-z0-9-]+" value={slug} onChange={(e) => setSlug(e.target.value)} className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-slate-500">Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col col-span-2">
        <span className="text-xs text-slate-500">Git repo URL (https)</span>
        <input required value={gitRepoUrl} onChange={(e) => setGitRepoUrl(e.target.value)} className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-slate-500">Scope</span>
        <select value={scope} onChange={(e) => setScope(e.target.value as ProjectScope)} className="border rounded px-2 py-1">
          <option value="private">private (owner + admin only)</option>
          <option value="dept">dept (same department)</option>
          <option value="public">public (any authenticated user)</option>
        </select>
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-slate-500">Description (optional)</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="border rounded px-2 py-1" />
      </label>
      <div className="col-span-2 flex justify-end">
        <button type="submit" className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">
          Submit for approval
        </button>
      </div>
    </form>
  );
}

function SecretModal({ projectId, secret, onClose }: { projectId: number; secret: string; onClose: () => void }) {
  const copy = () => navigator.clipboard.writeText(secret).catch(() => {});
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-2">Webhook secret — project #{projectId}</h2>
        <p className="text-sm text-red-600 mb-3">
          Save this now. Không hiển thị lại — nếu mất phải Regen.
        </p>
        <div className="font-mono text-xs bg-slate-100 p-3 rounded break-all mb-3">{secret}</div>
        <div className="flex justify-end gap-2">
          <button onClick={copy} className="px-3 py-1.5 rounded border text-sm hover:bg-slate-50">Copy</button>
          <button onClick={onClose} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">
            I saved it
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    suspended: 'bg-slate-200 text-slate-700',
  };
  return <span className={`px-2 py-0.5 rounded text-xs ${cls[status] ?? 'bg-slate-100'}`}>{status}</span>;
}

function ActionBtn({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant: 'ok' | 'bad' | 'warn' | 'neutral';
}) {
  const cls: Record<string, string> = {
    ok: 'bg-green-600 text-white hover:bg-green-700',
    bad: 'bg-red-600 text-white hover:bg-red-700',
    warn: 'bg-yellow-500 text-white hover:bg-yellow-600',
    neutral: 'border text-slate-700 hover:bg-slate-50',
  };
  return (
    <button onClick={onClick} className={`px-2 py-0.5 rounded text-xs ${cls[variant]}`}>
      {children}
    </button>
  );
}
