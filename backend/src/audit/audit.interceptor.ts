import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuthedRequest } from '../common/user-request';
import { AuditLogService } from './audit-log.service';

// Global interceptor — log mọi POST/PUT/PATCH/DELETE khi response thành công.
// Read (GET) không log để giảm noise; specific routes có thể tự log qua AuditLogService khi cần.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditLogService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const method = req.method;
    if (!MUTATING_METHODS.has(method)) return next.handle();

    const path = req.originalUrl || req.url;

    return next.handle().pipe(
      tap(() => {
        this.audit.record({
          actor: req.user ?? null,
          action: `${method} ${path.split('?')[0]}`,
          ip: req.clientIp,
        });
      }),
    );
  }
}
