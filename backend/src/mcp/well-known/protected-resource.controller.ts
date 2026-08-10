import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// RFC 9728 (draft) — OAuth 2.0 Protected Resource Metadata.
// MCP clients read this to learn which AS issues tokens accepted by OneMCP.
@Controller('.well-known/oauth-protected-resource')
export class ProtectedResourceController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'public, max-age=3600')
  metadata(): Record<string, unknown> {
    return {
      resource: this.config.get<string>('OAUTH_RESOURCE_URL'),
      authorization_servers: [this.config.get<string>('OAUTH_ISSUER')],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp'],
    };
  }
}
