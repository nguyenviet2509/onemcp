// AuthChip — env-gated selector between SSO UserMenu and legacy IdentifyAsDropdown.
// Server Component (no 'use client') — reads env at render time.
// Rendered inside SidebarUserCard zone via layout.tsx swap (see app-shell / layout).
//
// ENV contract:
//   NEXT_PUBLIC_AUTH_MODE=gitlab-sso  → UserMenu (session cookie)
//   NEXT_PUBLIC_AUTH_MODE=trust-header (default) → IdentifyAsDropdown (localStorage)
import { UserMenu } from './user-menu';
import { IdentifyAsDropdown } from './identify-as-dropdown';

export function AuthChip() {
  const authMode = process.env.NEXT_PUBLIC_AUTH_MODE;
  if (authMode === 'gitlab-sso') {
    return <UserMenu />;
  }
  return <IdentifyAsDropdown />;
}
