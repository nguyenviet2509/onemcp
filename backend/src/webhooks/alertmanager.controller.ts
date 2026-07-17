import { BadRequestException, Body, Controller, Logger, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AlertmanagerTokenGuard } from './alertmanager-token.guard';
import { AlertmanagerPayload, AlertmanagerService } from './alertmanager.service';

// POST /api/webhooks/alertmanager
// Auth: Bearer token via AlertmanagerTokenGuard (RT-1 — NOT HmacGuard).
// Returns 202 immediately after auth + structure validation (RT-8).
// All downstream work (search + Slack) runs asynchronously via setImmediate.
// This ensures Alertmanager never retries due to downstream slowness/failures.
@Controller('webhooks/alertmanager')
export class AlertmanagerController {
  private readonly log = new Logger(AlertmanagerController.name);

  constructor(private readonly svc: AlertmanagerService) {}

  // H5 fix: rate-limit to protect against token leak amplification.
  // 120/min accommodates correlated alert storms; nginx IP allowlist enforces layer-1 defense.
  @Post()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @UseGuards(AlertmanagerTokenGuard)
  async receive(
    @Body() payload: unknown,
    @Res() res: Response,
  ): Promise<void> {
    // Validate minimal payload structure at the boundary.
    if (
      !payload ||
      typeof payload !== 'object' ||
      !Array.isArray((payload as Record<string, unknown>)['alerts'])
    ) {
      throw new BadRequestException('bad_payload: alerts array required');
    }

    const typed = payload as AlertmanagerPayload;

    // ACK immediately — Alertmanager must not wait on search/Slack (RT-8).
    res.status(202).json({ accepted: true });

    // Process async. Errors are caught inside handle() — never propagate here.
    setImmediate(() => {
      this.svc.handle(typed).catch((e: unknown) => {
        this.log.error(`alertmanager async handler error: ${(e as Error).message}`);
      });
    });
  }
}
