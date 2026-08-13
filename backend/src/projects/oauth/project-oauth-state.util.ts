import { createHmac, timingSafeEqual } from 'crypto';

// Signed opaque state for GitLab OAuth roundtrip.
// Format: base64url(JSON payload) + '.' + base64url(HMAC-SHA256(payload, secret))
// TTL enforced by exp field (unix seconds).
export interface ProjectOauthStatePayload {
  slug: string;
  name: string;
  description?: string;
  gitRepoUrl: string;
  scope: 'public' | 'dept' | 'private';
  userId: number;
  exp: number;
}

const b64u = (buf: Buffer): string =>
  buf.toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const b64uDecode = (s: string): Buffer => {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad), 'base64');
};

export function signState(payload: ProjectOauthStatePayload, secret: string): string {
  const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = b64u(createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyState(state: string, secret: string): ProjectOauthStatePayload {
  const [body, sig] = state.split('.');
  if (!body || !sig) throw new Error('Malformed state');
  const expected = b64u(createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Invalid state signature');
  const payload = JSON.parse(b64uDecode(body).toString('utf8')) as ProjectOauthStatePayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('State expired');
  return payload;
}
