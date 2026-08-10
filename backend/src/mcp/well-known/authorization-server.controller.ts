import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// RFC 8414 — OAuth 2.0 Authorization Server Metadata.
// Public endpoint (no auth). Values default to placeholders until Zitadel prod wired.
// MCP clients (Claude Desktop, ChatGPT) hit this to discover OAuth flow.
@Controller('.well-known/oauth-authorization-server')
export class AuthorizationServerController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'public, max-age=3600')
  metadata(): Record<string, unknown> {
    const issuer = this.config.get<string>('OAUTH_ISSUER')!;
    return {
      issuer,
      authorization_endpoint: this.config.get<string>('OAUTH_AUTH_URL'),
      token_endpoint: this.config.get<string>('OAUTH_TOKEN_URL'),
      registration_endpoint: this.config.get<string>('OAUTH_REGISTRATION_URL'),
      scopes_supported: ['openid', 'profile', 'email', 'mcp'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
    };
  }
}
