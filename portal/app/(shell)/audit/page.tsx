'use client';

import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api-client';
import {
  AuditMcpCallRow,
  listMcpCallUsers,
  listMcpCalls,
  ListMcpCallsParams,
} from '@/lib/api/audit';
import { Pagination } from '@/components/pagination';

interface Me {
  id: number;
  username: string;
  roles: string[];
}

type PageSize = 10 | 20 | 50 | 100;

const KNOWN_TOOLS = [
  'list_skills',
  'load_skill',
  'list_artifacts',
  'get_artifact',
  'get_artifact_template',
  'search',
  'submit_artifact',
  'load_runbook',
] as const;

const DATE_PRESETS = [
  { label: 'Last 1h', hours: 1 },
  { label: 'Last 24h', hours: 24 },
  { label: 'Last 7d', hours: 24 * 7 },
  { label: 'Last 30d', hours: 24 * 30 },
] as const;

// Plan 260908-1552 phase 07 — dept-admin audit view for MCP tool calls.
// Filter panel + keyset-paginated table + row detail modal.
export default function AuditPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const [rows, setRows] = useState<AuditMcpCallRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditMcpCallRow | null>(null);

  // Filter state
  const [rangeHours, setRangeHours] = useState<number>(24);
  const [userFilter, setUserFilter] = useState<string>('');
  const [toolFilter, setToolFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ok' | 'error'>('');

  // Pagination state (shared Pagination component pattern)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);

  const isAdmin =
    me?.roles?.some((r) => r === 'super-admin' || r === 'dept-admin') ?? false;

  useEffect(() => {
    apiFetch<Me>('/me')
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  // Fetch on any filter or pagination change
  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    const from = new Date(Date.now() - rangeHours * 3600_000).toISOString();
    const params: ListMcpCallsParams = { from, page, pageSize };
    if (userFilter) params.user = userFilter;
    if (toolFilter) params.tool = toolFilter;
    if (statusFilter) params.status = statusFilter;
    listMcpCalls(params)
      .then((res) => {
        setRows(res.rows);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  }, [isAdmin, rangeHours, userFilter, toolFilter, statusFilter, page, pageSize]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [rangeHours, userFilter, toolFilter, statusFilter]);

  // User dropdown values
  useEffect(() => {
    if (!isAdmin) return;
    listMcpCallUsers()
      .then(setUsers)
      .catch(() => {
        // Empty dropdown OK — user can still filter by typing
      });
  }, [isAdmin]);

  const refresh = () => {
    // Force re-fetch by triggering effect via page bump (harmless if already 1)
    setPage((p) => p);
    // Above no-ops setState if unchanged. Use synthetic trigger.
    setLoading(true);
    const from = new Date(Date.now() - rangeHours * 3600_000).toISOString();
    const params: ListMcpCallsParams = { from, page, pageSize };
    if (userFilter) params.user = userFilter;
    if (toolFilter) params.tool = toolFilter;
    if (statusFilter) params.status = statusFilter;
    listMcpCalls(params)
      .then((res) => {
        setRows(res.rows);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  };

  if (me && !isAdmin) {
    return (
      <div className="px-8 py-6">
        <h1 className="text-2xl font-semibold mb-2">Audit — MCP Tool Calls</h1>
        <p className="text-sm text-red-600">
          Access denied — dept-admin or super-admin role required.
        </p>
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Audit — MCP Tool Calls</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Per-call audit for AI-connector tool invocations. Args redacted (HMAC hash).
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Filter panel */}
      <div className="border rounded p-3 mb-4 grid grid-cols-4 gap-3 text-sm">
        <label className="flex flex-col">
          <span className="text-xs text-slate-500">Date range</span>
          <select
            value={rangeHours}
            onChange={(e) => setRangeHours(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.hours} value={p.hours}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-slate-500">User</span>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">(all users)</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-slate-500">Tool</span>
          <select
            value={toolFilter}
            onChange={(e) => setToolFilter(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">(all tools)</option>
            {KNOWN_TOOLS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-slate-500">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | 'ok' | 'error')}
            className="border rounded px-2 py-1"
          >
            <option value="">(all)</option>
            <option value="ok">ok</option>
            <option value="error">error</option>
          </select>
        </label>
      </div>

      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      {/* Table */}
      <div className="rounded border">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-44" />
            <col className="w-28" />
            <col />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-32" />
            <col className="w-16" />
          </colgroup>
          <thead className="bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Tool</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Dur ms</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2 text-right">·</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="align-middle hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{fmtTs(r.ts)}</td>
                <td className="px-3 py-2 truncate">{r.actor_username}</td>
                <td className="px-3 py-2 font-mono text-xs truncate">{r.tool}</td>
                <td className="px-3 py-2">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.duration_ms ?? '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500 truncate">
                  {r.ip ?? '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setDetail(r)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    view
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                  No audit rows in this window. If audit is disabled, check
                  <code className="mx-1">MCP_TOOL_AUDIT_ENABLED</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Shared Pagination — same style as Artifacts/Skills */}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {detail && <DetailModal row={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// Format ISO timestamp as UTC+7 (Asia/Ho_Chi_Minh) — matches Vietnam operator TZ.
const TS_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function fmtTs(iso: string): string {
  const parts = TS_FMT.formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')} +07`;
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    ok: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    unknown: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${cls[status] ?? 'bg-slate-100'}`}>
      {status}
    </span>
  );
}

function DetailModal({ row, onClose }: { row: AuditMcpCallRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            <code className="text-sm font-mono text-blue-600">{row.tool}</code>
            <span className="text-slate-500 text-sm ml-2">— {row.actor_username}</span>
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-xl leading-none">
            ×
          </button>
        </div>
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <Detail label="Timestamp" value={fmtTs(row.ts)} mono />
          <Detail label="Duration" value={row.duration_ms != null ? `${row.duration_ms} ms` : '—'} />
          <Detail label="Status" value={row.status} />
          <Detail label="Client ID" value={row.session_id ?? '—'} mono col={3} />
          <Detail label="IP" value={row.ip ?? '—'} mono />
          <Detail label="Args hash" value={row.args_hash ?? '—'} mono col={2} />
          {row.resource_id && <Detail label="Resource" value={row.resource_id} mono col={3} />}
          {row.error && (
            <div className="col-span-3">
              <dt className="text-xs text-slate-500 uppercase tracking-wide">Error</dt>
              <dd className="mt-1 text-xs font-mono text-red-700 bg-red-50 p-2 rounded whitespace-pre-wrap break-all">
                {row.error}
              </dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-slate-500 mt-4">
          Row ID <code className="font-mono">{row.id}</code>. Full args stored locally
          (redacted per-tool). Query by args_hash to correlate duplicate calls.
        </p>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  col,
}: {
  label: string;
  value: string;
  mono?: boolean;
  col?: number;
}) {
  const colCls = col === 3 ? 'col-span-3' : col === 2 ? 'col-span-2' : '';
  return (
    <div className={colCls}>
      <dt className="text-xs text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className={`mt-0.5 text-sm ${mono ? 'font-mono text-xs' : ''} break-all`}>{value}</dd>
    </div>
  );
}
