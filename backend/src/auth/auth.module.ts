import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { CookieAuthMiddleware } from './cookie-auth.middleware';
import { GitlabOAuthService } from './gitlab-oauth.service';
import { SessionService } from './session.service';

// AuthModule wires GitLab OAuth2 + Redis session infrastructure.
// CookieAuthMiddleware is exported so AccessModule can register it conditionally
// in the middleware chain when AUTH_MODE=gitlab-sso.
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [GitlabOAuthService, SessionService, CookieAuthMiddleware],
  exports: [SessionService, CookieAuthMiddleware],
})
export class AuthModule {}
