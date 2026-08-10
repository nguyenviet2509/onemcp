import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// RFC 8414 — OAuth 2.0 Authorization Server Metadata.
// Public endpoint (no auth). Endpoint URLs derived from OAUTH_ISSUER base.
// Update OAUTH_ISSUER env to real domain when TLS ready — no code change needed.
@Controller('.well-known/oauth-authorization-server')
export class AuthorizationServerController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'public, max-age=3600')
  metadata(): Record<string, unknown> {
    const issuer = (this.config.get<string>('OAUTH_ISSUER') ?? '').replace(/\/$/, '');
    return {
      issuer,
      authorization_endpoint: `${issuer}/api/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      registration_endpoint: `${issuer}/api/oauth/register`,
      revocation_endpoint: `${issuer}/api/oauth/revoke`,
      scopes_supported: ['mcp'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    };
  }
}
