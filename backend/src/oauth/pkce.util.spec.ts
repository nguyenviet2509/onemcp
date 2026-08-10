import { verifyPkce } from './pkce.util';

// RFC 7636 Appendix B — reference vector for S256:
//   code_verifier  = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
//   code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
const RFC7636_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC7636_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('verifyPkce', () => {
  it('accepts RFC 7636 canonical S256 vector', () => {
    expect(verifyPkce(RFC7636_VERIFIER, RFC7636_CHALLENGE, 'S256')).toBe(true);
  });

  it('rejects wrong verifier', () => {
    expect(verifyPkce('a'.repeat(43), RFC7636_CHALLENGE, 'S256')).toBe(false);
  });

  it('rejects "plain" method (OAuth 2.1)', () => {
    expect(verifyPkce(RFC7636_VERIFIER, RFC7636_VERIFIER, 'plain')).toBe(false);
  });

  it('rejects unknown method', () => {
    expect(verifyPkce(RFC7636_VERIFIER, RFC7636_CHALLENGE, 'SHA1')).toBe(false);
  });

  it('rejects too-short verifier (< 43 chars)', () => {
    expect(verifyPkce('short', RFC7636_CHALLENGE, 'S256')).toBe(false);
  });

  it('rejects too-long verifier (> 128 chars)', () => {
    expect(verifyPkce('a'.repeat(129), RFC7636_CHALLENGE, 'S256')).toBe(false);
  });

  it('rejects empty verifier or challenge', () => {
    expect(verifyPkce('', RFC7636_CHALLENGE, 'S256')).toBe(false);
    expect(verifyPkce(RFC7636_VERIFIER, '', 'S256')).toBe(false);
  });
});
