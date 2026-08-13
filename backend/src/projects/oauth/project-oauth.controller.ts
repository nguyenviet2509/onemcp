import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { CurrentUser } from '../../access/current-user.decorator';
import { AuthedRequest, RequestUser } from '../../common/user-request';
import { ProjectOauthService } from './project-oauth.service';

// Portal-facing OAuth flow to auto-provision GitLab webhook + deploy token so
// members no longer copy-paste 2 secrets between GitLab and OneMCP.
@Controller('projects/oauth')
export class ProjectOauthController {
  private readonly log = new Logger(ProjectOauthController.name);

  constructor(
    private readonly svc: ProjectOauthService,
    private readonly config: ConfigService,
  ) {}

  private mustAuth(user: RequestUser | undefined): RequestUser {
    if (!user) throw new UnauthorizedException();
    return user;
  }

  // Step 1: portal POSTs desired project fields → we sign state + return GitLab authorize URL.
  // (POST used instead of GET so payload does not leak into referer/log lines.)
  @Post('authorize')
  authorize(
    @CurrentUser() user: RequestUser | undefined,
    @Body()
    body: {
      slug?: string;
      name?: string;
      description?: string;
      gitRepoUrl?: string;
      scope?: 'public' | 'dept' | 'private';
    },
  ): { authorizeUrl: string } {
    const u = this.mustAuth(user);
    if (!body?.slug || !body?.name || !body?.gitRepoUrl) {
      throw new BadRequestException('slug, name, gitRepoUrl are required');
    }
    return { authorizeUrl: this.svc.buildAuthorizeUrl(u.id, body as never) };
  }

  // Step 2: GitLab redirects here with ?code=&state=. We exchange, call APIs,
  // insert project, then bounce user back to portal /projects.
  @Get('callback')
  async callback(
    @CurrentUser() user: RequestUser | undefined,
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ): Promise<void> {
    const portalBase =
      this.config.get<string>('PORTAL_BASE_URL') ??
      `${req.protocol}://${req.headers.host}`;

    if (error) {
      this.log.warn(`oauth callback error=${error} desc=${errorDescription}`);
      res.redirect(`${portalBase}/projects?oauth_error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code || !state) {
      res.redirect(`${portalBase}/projects?oauth_error=missing_params`);
      return;
    }

    const u = this.mustAuth(user);
    try {
      const { project, webhookSecret } = await this.svc.completeAuthorize(code, state, u);
      res.redirect(
        `${portalBase}/projects?created=${project.id}&secret=${encodeURIComponent(webhookSecret)}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`oauth provision failed: ${msg}`);
      res.redirect(`${portalBase}/projects?oauth_error=${encodeURIComponent(msg.slice(0, 200))}`);
    }
  }
}
