import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BearerAuthMiddleware } from './bearer-auth.middleware';
import { BearerGuard } from './bearer.guard';
import { OAuthClient } from './entities/oauth-client.entity';
import { OAuthConsent } from './entities/oauth-consent.entity';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { OAuthTokenStore } from './token-store.service';

@Module({
  imports: [TypeOrmModule.forFeature([OAuthClient, OAuthConsent])],
  providers: [OAuthTokenStore, OAuthService, BearerGuard, BearerAuthMiddleware],
  controllers: [OAuthController],
  exports: [OAuthService, BearerGuard, BearerAuthMiddleware],
})
export class OAuthModule {}
