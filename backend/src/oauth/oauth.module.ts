import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BearerGuard } from './bearer.guard';
import { OAuthClient } from './entities/oauth-client.entity';
import { OAuthConsent } from './entities/oauth-consent.entity';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { OAuthTokenStore } from './token-store.service';

@Module({
  imports: [TypeOrmModule.forFeature([OAuthClient, OAuthConsent])],
  providers: [OAuthTokenStore, OAuthService, BearerGuard],
  controllers: [OAuthController],
  exports: [OAuthService, BearerGuard],
})
export class OAuthModule {}
