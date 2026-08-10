import { createHmac, timingSafeEqual } from 'crypto';

// GitLab's `X-Gitlab-Token` header can be:
//   - a shared secret sent verbatim, or
//   - HMAC-SHA256(rawBody, secret) hex.
// This util accepts either. Timing-safe comparison used throughout.
export function verifyGitlabToken(token: string, secret: string, rawBody?: Buffer): boolean {
  if (!token || !secret) return false;
  if (constantTimeEq(token, secret)) return true;
  if (rawBody) {
    const computed = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (constantTimeEq(token, computed)) return true;
  }
  return false;
}

function constantTimeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
