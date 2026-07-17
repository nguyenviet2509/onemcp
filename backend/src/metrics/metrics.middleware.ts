import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

// HTTP req instrumentation. Route label = req.route.path nếu có,
// fallback req.path. Prevent high-cardinality: normalize numeric IDs.
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      const route = this.normalize(req);
      const labels = { method: req.method, route, status: String(res.statusCode) };
      this.metrics.httpRequests.inc(labels);
      this.metrics.httpDuration.observe(labels, durationSec);
    });
    next();
  }

  private normalize(req: Request): string {
    const path = req.route?.path || req.path || 'unknown';
    // Replace numeric segments để tránh cardinality explosion.
    return path.replace(/\/\d+(?=\/|$)/g, '/:id');
  }
}
