import { BadRequestException, Body, Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { IsEmail } from 'class-validator';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { AuditLogService } from '../audit/audit-log.service';

/**
 * SSO revoke webhook — Central RBAC gọi khi admin revoke role user cuối cùng (via
 * `POST /v1/assignments/:id` outbox `notify_app_revoke` → HMAC-signed POST tới đây).
 *
 * OneMCP không có refresh_token/session table local (JWT Zitadel là source of truth, backend
 * recreate RequestUser mỗi request từ claims). Nên "revoke" ở đây = xoá UserRole rows để user
 * mất mọi role local ngay. Login lại qua SSO → nếu Zitadel còn role thì được tạo UserRole mới,
 * nếu không thì user vẫn tồn tại nhưng 0 role (không access được resource yêu cầu role).
 *
 * Path `/api/webhooks/sso-revoke` (KHÔNG /api/auth/*) vì nginx route /api/auth/* sang NextAuth
 * portal namespace — backend claim path đó sẽ 400.
 *
 * Bảo mật: HMAC-SHA256 signature qua env SSO_REVOKE_SECRET (cùng giá trị Central lưu ở
 * rbac.apps.revoke_secret). Verify constant-time.
 * Format: msg = `${userEmail.toLowerCase()}|revoke`, header `X-Sso-Revoke-Signature: sha256=${hex}`
 */

class SsoRevokeDto {
  @IsEmail()
  userEmail!: string;
}

@Controller('webhooks')
export class SsoRevokeController {
  private readonly logger = new Logger(SsoRevokeController.name);
  private readonly secret: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole) private readonly userRoleRepo: Repository<UserRole>,
    private readonly audit: AuditLogService,
  ) {
    this.secret = config.get<string>('SSO_REVOKE_SECRET') ?? '';
  }

  @Post('sso-revoke')
  @HttpCode(200)
  async revoke(
    @Body() dto: SsoRevokeDto,
    @Headers('x-sso-revoke-signature') signature: string,
  ) {
    if (!this.secret) {
      throw new BadRequestException('SSO revoke endpoint disabled (SSO_REVOKE_SECRET chưa set)');
    }
    if (!signature) {
      throw new BadRequestException('Missing X-Sso-Revoke-Signature header');
    }
    this.verifySignature(dto, signature);

    const email = dto.userEmail.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      this.logger.log(`SSO revoke: ${email} not found local — noop`);
      return { status: 'noop', reason: 'user_not_found_local' };
    }

    const deleted = await this.userRoleRepo.delete({ userId: user.id });
    const rolesRemoved = deleted.affected ?? 0;

    this.logger.log(`SSO revoke: ${email} (userId=${user.id}) — removed ${rolesRemoved} role(s)`);

    this.audit.record({
      actor: null, // System-triggered from Central RBAC webhook
      action: 'user.sso.revoke',
      resourceType: 'user',
      resourceId: String(user.id),
      after: { email, rolesRemoved },
    });

    return { status: 'revoked', userId: user.id, rolesRemoved };
  }

  /**
   * Deterministic HMAC: `msg = ${userEmail}|revoke`. Caller (Central) build cùng format:
   *   msg = `${userEmail}|revoke`
   *   signature = "sha256=" + hex_hmac_sha256(secret, msg)
   */
  private verifySignature(dto: SsoRevokeDto, signature: string): void {
    const msg = `${dto.userEmail.trim().toLowerCase()}|revoke`;
    const expected = createHmac('sha256', this.secret).update(msg).digest('hex');
    const provided = signature.replace(/^sha256=/, '');
    if (
      expected.length !== provided.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
    ) {
      throw new BadRequestException('Invalid HMAC signature');
    }
  }
}
