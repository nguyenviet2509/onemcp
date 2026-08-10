import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { CurrentUser } from '../access/current-user.decorator';
import { AuthedRequest, RequestUser } from '../common/user-request';
import { AuthorizeParams, OAuthService, RegisterClientDto } from './oauth.service';

// OAuth 2.1 Authorization Server public endpoints.
// All under /api prefix per global config, EXCEPT paths listed here that are
// explicitly excluded from /api (see main.ts) — see individual routes below.
// Endpoints:
//   POST /api/oauth/register        — RFC 7591 DCR
//   GET  /api/oauth/authorize       — start authorization code flow (browser)
//   POST /api/oauth/authorize/consent — after user allows on portal consent screen
//   POST /api/oauth/token           — exchange code / refresh (public)
//   POST /api/oauth/revoke          — revoke token (public)
//   GET  /api/oauth/client-info     — consent screen fetches this (public)
@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(
    @Body() dto: RegisterClientDto,
    @CurrentUser() user: RequestUser | undefined,
  ) {
    return this.oauth.registerClient(dto, user?.id);
  }

  @Get('client-info')
  async clientInfo(@Query('client_id') clientId: string) {
    if (!clientId) throw new BadRequestException('client_id required');
    return this.oauth.publicClientInfo(clientId);
  }

  // Browser hits this after login. If consent recorded → auto-redirect with code.
  // Otherwise redirect to portal consent screen with same params preserved.
  @Get('authorize')
  async authorize(
    @Query() q: Record<string, string>,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ) {
    const params: AuthorizeParams = {
      clientId: q.client_id,
      redirectUri: q.redirect_uri,
      codeChallenge: q.code_challenge,
      codeChallengeMethod: q.code_challenge_method,
      scope: q.scope,
      state: q.state,
    };
    if (!params.clientId || !params.redirectUri) {
      throw new BadRequestException('client_id and redirect_uri required');
    }
    if (q.response_type !== 'code') {
      return this.redirectWithError(res, params.redirectUri, 'unsupported_response_type', params.state);
    }
    const user = req.user;
    if (!user) throw new UnauthorizedException('login required (no session)');

    try {
      const result = await this.oauth.prepareAuthorization(params, user.id, user.username);
      if (result.action === 'auto-code') {
        return this.redirectWithCode(res, params.redirectUri, result.code, params.state);
      }
      // Consent required → send user to portal consent page with query params.
      const consentUrl = new URL('/oauth-consent', this.getPortalBase());
      consentUrl.searchParams.set('client_id', params.clientId);
      consentUrl.searchParams.set('redirect_uri', params.redirectUri);
      consentUrl.searchParams.set('code_challenge', params.codeChallenge);
      consentUrl.searchParams.set('code_challenge_method', params.codeChallengeMethod);
      if (params.scope) consentUrl.searchParams.set('scope', params.scope);
      if (params.state) consentUrl.searchParams.set('state', params.state);
      return res.redirect(302, consentUrl.toString());
    } catch (e) {
      const err = e as Error & { message?: string };
      return this.redirectWithError(res, params.redirectUri, 'invalid_request', params.state, err.message);
    }
  }

  // Portal consent screen posts here after user clicks Allow.
  // Returns redirect URL for the client to navigate to (portal handles the redirect).
  @Post('authorize/consent')
  async consent(
    @Body() body: Record<string, string>,
    @CurrentUser() user: RequestUser | undefined,
  ): Promise<{ redirect: string }> {
    if (!user) throw new UnauthorizedException();
    const params: AuthorizeParams = {
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      codeChallenge: body.code_challenge,
      codeChallengeMethod: body.code_challenge_method,
      scope: body.scope,
      state: body.state,
    };
    const code = await this.oauth.grantConsent(params, user.id, user.username);
    const url = new URL(params.redirectUri);
    url.searchParams.set('code', code);
    if (params.state) url.searchParams.set('state', params.state);
    return { redirect: url.toString() };
  }

  @Post('token')
  async token(@Body() body: Record<string, string>) {
    const grantType = body.grant_type;
    if (grantType === 'authorization_code') {
      return this.oauth.exchangeCode({
        code: body.code,
        codeVerifier: body.code_verifier,
        clientId: body.client_id,
        clientSecret: body.client_secret,
        redirectUri: body.redirect_uri,
      });
    }
    if (grantType === 'refresh_token') {
      return this.oauth.refresh({
        refreshToken: body.refresh_token,
        clientId: body.client_id,
        clientSecret: body.client_secret,
      });
    }
    throw new BadRequestException(`unsupported grant_type: ${grantType}`);
  }

  @Post('revoke')
  @HttpCode(200)
  async revoke(@Body() body: Record<string, string>) {
    if (!body.token) throw new BadRequestException('token required');
    const hint = body.token_type_hint === 'refresh_token' || body.token_type_hint === 'access_token' ? body.token_type_hint : undefined;
    await this.oauth.revoke({ token: body.token, tokenTypeHint: hint });
    // RFC 7009: MUST return 200 regardless of token validity.
    return {};
  }

  private redirectWithCode(res: Response, redirectUri: string, code: string, state?: string) {
    const url = new URL(redirectUri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);
    return res.redirect(302, url.toString());
  }

  private redirectWithError(res: Response, redirectUri: string, error: string, state?: string, description?: string) {
    try {
      const url = new URL(redirectUri);
      url.searchParams.set('error', error);
      if (description) url.searchParams.set('error_description', description.slice(0, 200));
      if (state) url.searchParams.set('state', state);
      return res.redirect(302, url.toString());
    } catch {
      return res.status(400).json({ error, error_description: description });
    }
  }

  private getPortalBase(): string {
    // Same-origin default (nginx routes portal at /) — env override for split deploys.
    return this.config.get<string>('PORTAL_BASE_URL', '');
  }
}
