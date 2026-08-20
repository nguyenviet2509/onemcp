// NextAuth v5 (Auth.js) — OIDC provider Zitadel.
// Plan 260819-1628 phase-03. Dual-mode với IAP hiện tại — kích hoạt khi
// AUTH_MODE=oidc trong env. AUTH_MODE=iap (default) → NextAuth handlers vẫn
// mount nhưng redirect từ middleware skip → IAP flow không đổi.
//
// Session shape: accessToken forward xuống backend qua Bearer (Cơ chế 2).
// Roles: lấy từ claim raw `urn:zitadel:iam:org:project:roles` (Actions v1
// bypass trên Zitadel v4.16 login_v2 — xem docs/authway-role-catalog.md).

import NextAuth, { type NextAuthConfig } from 'next-auth';

const issuer = process.env.ZITADEL_ISSUER ?? 'http://10.200.0.125';

// Extract Zitadel role keys từ claim raw. Same logic backend zitadel-jwt.middleware.ts.
function extractRoles(profile: Record<string, unknown>): string[] {
  const raw = profile['urn:zitadel:iam:org:project:roles'];
  if (raw && typeof raw === 'object') return Object.keys(raw as Record<string, unknown>);
  return [];
}

const config: NextAuthConfig = {
  providers: [
    {
      id: 'zitadel',
      name: 'Authway (Zitadel)',
      type: 'oidc',
      issuer,
      clientId: process.env.ZITADEL_CLIENT_ID,
      clientSecret: process.env.ZITADEL_CLIENT_SECRET,
      // Scopes basic — role đọc từ claim raw đã có sẵn khi assert_roles=true trên project.
      authorization: { params: { scope: 'openid email profile' } },
      idToken: true,
      // profile() runs once at sign-in; extract needed fields.
      profile(profile) {
        return {
          id: (profile.sub as string) ?? '',
          name: (profile.name as string) ?? (profile.preferred_username as string) ?? '',
          email: (profile.email as string) ?? '',
          roles: extractRoles(profile as Record<string, unknown>),
        };
      },
    },
  ],
  callbacks: {
    // JWT callback — chạy mỗi request có session. account chỉ có ở sign-in event.
    async jwt({ token, account, profile }) {
      if (account?.access_token) token.accessToken = account.access_token;
      if (account?.id_token) token.idToken = account.id_token;
      if (account?.expires_at) token.expiresAt = account.expires_at;
      if (profile) {
        token.roles = extractRoles(profile as Record<string, unknown>);
      }
      return token;
    },
    // Session callback — expose accessToken + roles cho client + server component.
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).accessToken = token.accessToken;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).roles = token.roles ?? [];
      return session;
    },
  },
  trustHost: true, // Chạy sau nginx TLS termination trên onemcp-vps.
  // KHÔNG override pages.signIn — v5 beta removed default UI, nhưng vẫn có
  // built-in provider page. Tự-reference vào handler tạo infinite loop.
  // Chỉ 1 provider → NextAuth auto-trigger OAuth khi hit /api/auth/signin/zitadel.
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
