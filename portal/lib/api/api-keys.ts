import { apiFetch } from '../api-client';

// API key management — personal keys scoped to the calling user.
export interface ApiKey {
  id: string;
  label: string;
  prefix: string;       // first 8 chars shown in list (full key never returned again)
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// Returned only on creation — full key value shown exactly once.
export interface ApiKeyCreated extends ApiKey {
  key: string;
}

export interface CreateApiKeyPayload {
  label: string;
  expiresInDays?: number;  // omit = no expiry
}

export function listMyKeys() {
  return apiFetch<ApiKey[]>('/api-keys');
}

export function createKey(payload: CreateApiKeyPayload) {
  return apiFetch<ApiKeyCreated>('/api-keys', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function revokeKey(id: string) {
  return apiFetch<void>(`/api-keys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
