import { apiFetch } from '../api-client';

export interface AuditMcpCallRow {
  id: string;
  ts: string;
  actor_username: string;
  tool: string;
  resource_id?: string;
  ip?: string;
  session_id?: string;
  status: 'ok' | 'error' | 'unknown';
  duration_ms?: number;
  error?: string;
  args_hash?: string;
}

export interface AuditListResponse {
  rows: AuditMcpCallRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListMcpCallsParams {
  user?: string;
  tool?: string;
  from?: string; // ISO
  to?: string; // ISO
  status?: 'ok' | 'error';
  page?: number;
  pageSize?: number;
}

export function listMcpCalls(params: ListMcpCallsParams = {}): Promise<AuditListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  const query = qs.toString();
  return apiFetch<AuditListResponse>(`/audit/mcp-calls${query ? `?${query}` : ''}`);
}

export function listMcpCallUsers(): Promise<string[]> {
  return apiFetch<string[]>('/audit/mcp-calls/users');
}
