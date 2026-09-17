import { apiFetch } from '../api-client';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ToolUpstream {
  id: string;
  name: string;
  baseUrl: string;
  bearer: '***';
  timeoutMs: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ToolBridge {
  id: string;
  upstreamId: string;
  name: string;
  description: string;
  method: HttpMethod;
  path: string;
  paramSchema: Record<string, unknown>;
  permissionId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DryRunResult {
  schema_valid: boolean;
  errors: string[] | null;
  resolved_url: string;
  would_send_headers: Record<string, string>;
}

export interface CreateUpstreamPayload {
  name: string;
  baseUrl: string;
  bearer: string;
  timeoutMs?: number;
  enabled?: boolean;
}

export interface UpdateUpstreamPayload {
  name?: string;
  baseUrl?: string;
  bearer?: string;
  timeoutMs?: number;
  enabled?: boolean;
}

export interface CreateBridgePayload {
  upstreamId: string;
  name: string;
  description: string;
  method: HttpMethod;
  path: string;
  paramSchema: Record<string, unknown>;
  permissionId: string;
  enabled?: boolean;
}

export interface UpdateBridgePayload {
  upstreamId?: string;
  name?: string;
  description?: string;
  method?: HttpMethod;
  path?: string;
  paramSchema?: Record<string, unknown>;
  permissionId?: string;
  enabled?: boolean;
}

const BASE = '/api/admin';

export const listUpstreams = () => apiFetch<ToolUpstream[]>(`${BASE}/tool-upstreams`);
export const createUpstream = (p: CreateUpstreamPayload) =>
  apiFetch<ToolUpstream>(`${BASE}/tool-upstreams`, { method: 'POST', body: JSON.stringify(p) });
export const updateUpstream = (id: string, p: UpdateUpstreamPayload) =>
  apiFetch<ToolUpstream>(`${BASE}/tool-upstreams/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(p) });
export const disableUpstream = (id: string) =>
  apiFetch<void>(`${BASE}/tool-upstreams/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const listBridges = () => apiFetch<ToolBridge[]>(`${BASE}/tool-bridges`);
export const createBridge = (p: CreateBridgePayload) =>
  apiFetch<ToolBridge>(`${BASE}/tool-bridges`, { method: 'POST', body: JSON.stringify(p) });
export const updateBridge = (id: string, p: UpdateBridgePayload) =>
  apiFetch<ToolBridge>(`${BASE}/tool-bridges/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(p) });
export const disableBridge = (id: string) =>
  apiFetch<void>(`${BASE}/tool-bridges/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const testBridge = (id: string, args: Record<string, unknown>) =>
  apiFetch<DryRunResult>(`${BASE}/tool-bridges/${encodeURIComponent(id)}/test`, {
    method: 'POST',
    body: JSON.stringify({ args }),
  });
