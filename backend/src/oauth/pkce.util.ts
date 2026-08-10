import { createHash } from 'crypto';

// RFC 7636 PKCE — verify code_verifier against stored code_challenge.
// OAuth 2.1 mandates S256; `plain` explicitly rejected.
export function verifyPkce(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method !== 'S256') return false;
  if (!codeVerifier || !codeChallenge) return false;
  // RFC 7636 §4.1: verifier is 43–128 unreserved chars.
  if (codeVerifier.length < 43 || codeVerifier.length > 128) return false;
  const hash = createHash('sha256').update(codeVerifier).digest();
  const computed = base64url(hash);
  return computed === codeChallenge;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
