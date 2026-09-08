import { createHmac } from 'crypto';
import { Logger } from '@nestjs/common';

const log = new Logger('McpArgsRedactor');

// Known MCP tool names (whitelist for input validation in Phase 07 too).
export const KNOWN_MCP_TOOLS = [
  'list_skills',
  'load_skill',
  'list_artifacts',
  'get_artifact',
  'get_artifact_template',
  'search',
  'submit_artifact',
  'load_runbook',
] as const;
export type McpToolName = (typeof KNOWN_MCP_TOOLS)[number];

// F6 red-team fix: HMAC-SHA256 with per-install secret. 64-bit truncated hash is
// trivially brute-forceable for short queries (search text, artifact titles) —
// HMAC secret prevents offline rainbow-table attacks by dept-admin readers.
// Rotate secret = old hashes lose correlation (acceptable tradeoff for v1).
let SECRET: Buffer | null = null;

export function initHashSecret(secret: string): void {
  if (!secret || secret.length < 32) {
    throw new Error('MCP_AUDIT_HASH_SECRET must be ≥32 chars (openssl rand -base64 48)');
  }
  SECRET = Buffer.from(secret, 'utf8');
}

// HMAC-SHA256 truncated to 16 hex chars — enough to correlate duplicate calls,
// resistant to offline brute-force without SECRET.
function hashText(text: string): string {
  if (!SECRET) throw new Error('hash secret not initialized — call initHashSecret at boot');
  return createHmac('sha256', SECRET).update(text).digest('hex').slice(0, 16);
}

// F14 red-team fix: strip control chars (newline, tab, null) from user-controlled
// strings before writing to logs or audit fields. Prevents log-injection attacks
// where crafted tool.name = "foo\nEVIL SECURITY EVENT" spoofs log parsers.
export function sanitizeForLog(s: string, maxLen = 64): string {
  return String(s).replace(/[\r\n\t\x00-\x1f]/g, '_').slice(0, maxLen);
}

export interface RedactedArgs {
  args_hash: string; // Full args HMAC hash for correlate + cross-reference
  fields: Record<string, unknown>;
}

// Per-tool whitelist. Free-text keys (q, query, body, title) never stored raw —
// only length + HMAC hash. Unknown tools default to drop-all + warn.
type Redactor = (args: Record<string, unknown>) => Record<string, unknown>;

const POLICIES: Record<string, Redactor> = {
  list_skills: (a) => ({
    tag: typeof a.tag === 'string' ? a.tag : undefined,
    q_hash: typeof a.q === 'string' && a.q ? hashText(a.q) : undefined,
    q_len: typeof a.q === 'string' ? a.q.length : undefined,
  }),
  load_skill: (a) => ({
    name: typeof a.name === 'string' ? a.name : undefined,
  }),
  list_artifacts: (a) => ({
    type: typeof a.type === 'string' ? a.type : undefined,
    tag: typeof a.tag === 'string' ? a.tag : undefined,
    status: typeof a.status === 'string' ? a.status : undefined,
  }),
  get_artifact: (a) => ({
    id: a.id != null ? String(a.id) : undefined,
  }),
  get_artifact_template: (a) => ({
    type: typeof a.type === 'string' ? a.type : undefined,
  }),
  search: (a) => ({
    q_hash: typeof a.q === 'string' && a.q ? hashText(a.q) : undefined,
    q_len: typeof a.q === 'string' ? a.q.length : undefined,
    filters: a.filters ?? undefined, // struct — assume caller-controlled but safe
    top_k: typeof a.top_k === 'number' ? a.top_k : undefined,
  }),
  submit_artifact: (a) => ({
    type: typeof a.type === 'string' ? a.type : undefined,
    title_hash: typeof a.title === 'string' && a.title ? hashText(a.title) : undefined,
    // Body dropped entirely — may contain secrets/PII. Only key list retained.
    structured_keys:
      a.structured && typeof a.structured === 'object'
        ? Object.keys(a.structured as object)
        : undefined,
  }),
  load_runbook: (a) => ({
    name: typeof a.name === 'string' ? a.name : undefined,
    service: typeof a.service === 'string' ? a.service : undefined,
  }),
};

export function redactArgs(toolName: string, args: Record<string, unknown>): RedactedArgs {
  const fullHash = hashText(JSON.stringify(args ?? {}));
  const policy = POLICIES[toolName];
  if (!policy) {
    log.warn(`no redact policy for tool=${sanitizeForLog(toolName)} — dropping all args`);
    return { args_hash: fullHash, fields: { _policy: 'default_drop' } };
  }
  const raw = policy(args);
  // Drop undefined keys → JSONB compact
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) fields[k] = v;
  }
  // Safety net: truncate if serialized JSON >2KB (defense-in-depth)
  const json = JSON.stringify(fields);
  if (json.length > 2048) {
    return { args_hash: fullHash, fields: { _truncated: true, _size: json.length } };
  }
  return { args_hash: fullHash, fields };
}
