// NextAuth v5 route handler — mount /api/auth/signin, /api/auth/callback/zitadel,
// /api/auth/session, /api/auth/signout, /api/auth/csrf.
// Config trong lib/auth.ts. v5 beta exports handlers object.
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
