import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { CurrentUser } from '../access/current-user.decorator';
import { AuthedRequest, RequestUser } from '../common/user-request';
import { AuditLogService } from '../audit/audit-log.service';

// Session lifecycle events triggered từ portal (NextAuth signOut) hoặc
// backend flows không đi qua Zitadel — bổ sung cho Zitadel Actions v2
// vốn không emit khi user chỉ clear cookie NextAuth local.
//
// Route ở /api/audit/* (KHÔNG /api/auth/*) vì nginx route /api/auth/* sang
// portal (NextAuth namespace) — sẽ 400 nếu backend claim path đó.
@Controller('audit')
export class AuthController {
  constructor(private readonly audit: AuditLogService) {}

  // Portal gọi endpoint này TRƯỚC khi NextAuth signOut (clear cookie),
  // capture real user IP (browser → nginx → backend qua X-Forwarded-For)
  // + username từ identity chain. Publisher tự forward sang Central RBAC.
  @Post('logout-event')
  @HttpCode(204)
  logoutEvent(
    @Body() body: { session_id?: string; reason?: string } = {},
    @CurrentUser() user: RequestUser | undefined,
    @Req() req: AuthedRequest,
  ): void {
    this.audit.record({
      actor: user ?? null,
      action: 'user.logout',
      resourceType: 'session',
      resourceId: body.session_id,
      after: { reason: body.reason ?? 'user_initiated' },
      ip: req.ip,
      sessionId: body.session_id,
    });
  }
}
