import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuthedRequest } from '../common/user-request';
import { AuditLogService } from './audit-log.service';

// Global interceptor — log mọi POST/PUT/PATCH/DELETE khi response thành công.
// Read (GET) không log để giảm noise; specific routes tự log qua AuditLogService khi cần.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Paths đã có explicit AuditLogService.record() ở controller → skip interceptor
// để tránh duplicate rows trong audit UI (VD /api/audit/logout-event đã emit
// action='user.logout' rõ ràng, không cần thêm 'POST /api/audit/logout-event').
const EXCLUDED_PATH_PREFIXES = ['/api/audit/'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditLogService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const method = req.method;
    if (!MUTATING_METHODS.has(method)) return next.handle();

    const path = req.originalUrl || req.url;
    const cleanPath = path.split('?')[0];

    if (EXCLUDED_PATH_PREFIXES.some((p) => cleanPath.startsWith(p))) {
      return next.handle();
    }

    // Strip leading '/' so audit UI renders 'endpoint/api/mcp/' instead of
    // 'endpoint//api/mcp/' (formatTarget joins resourceType + '/' + resourceId).
    const resourceId = cleanPath.replace(/^\/+/, '');

    return next.handle().pipe(
      tap(() => {
        this.audit.record({
          actor: req.user ?? null,
          action: `${method} ${cleanPath}`,
          // Target hiển thị 'endpoint/<path>' trong audit UI — meaningful hơn 'unknown/unknown'.
          // Controller nào tự set resourceType/resourceId sẽ dùng riêng (VD oauth.client.register).
          resourceType: 'endpoint',
          resourceId,
          ip: req.clientIp,
        });
      }),
    );
  }
}
