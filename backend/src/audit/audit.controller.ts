import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { AuditListResponse, AuditQueryService } from './audit-query.service';
import { ListMcpCallsDto } from './list-mcp-calls.dto';

// F1 red-team fix: OneMCP backend has no RolesGuard/@Roles decorator. Use inline
// role check per existing codebase pattern (projects.service.ts, artifacts.service.ts).
// dept-admin | super-admin only — non-admins receive 403.
function requireAdmin(user: RequestUser | undefined): void {
  if (!user) throw new UnauthorizedException('unauthenticated');
  const isAdmin = user.roles.some((r) => r === 'dept-admin' || r === 'super-admin');
  if (!isAdmin) throw new ForbiddenException('audit view requires dept-admin');
}

// F2 red-team fix: strict input validation via class-validator DTO.
// transform: true — coerce query strings (limit=50 → number).
// whitelist + forbidNonWhitelisted — reject unknown query params (401 vs silent).
@Controller('audit')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class AuditController {
  constructor(private readonly query: AuditQueryService) {}

  // F12 red-team fix: 60/min throttle per client (matches global default).
  // Prevents scripted enumeration or DB exhaustion via deep pagination.
  @Get('mcp-calls')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async list(
    @CurrentUser() user: RequestUser | undefined,
    @Query() dto: ListMcpCallsDto,
  ): Promise<AuditListResponse> {
    requireAdmin(user);
    return this.query.queryMcpToolCalls({
      actorUsername: dto.user,
      tool: dto.tool,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      status: dto.status,
      page: dto.page ?? 1,
      pageSize: dto.pageSize ?? 20,
    });
  }

  @Get('mcp-calls/users')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async users(@CurrentUser() user: RequestUser | undefined): Promise<string[]> {
    requireAdmin(user);
    return this.query.listUsers();
  }
}
