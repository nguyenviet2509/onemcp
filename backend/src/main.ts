import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import express, { type Request } from 'express';
import { Logger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.schema';

async function bootstrap() {
  // Fail fast on invalid env.
  validateEnv(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Buffer raw body for /api/webhooks/gitlab HMAC verification.
    rawBody: true,
    bodyParser: false,
  });
  app.use(
    express.json({
      limit: '2mb',
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));
  app.useLogger(app.get(Logger));

  // Run migrations pending trước khi accept traffic.
  const ds = app.get(DataSource);
  const pending = await ds.showMigrations();
  if (pending) {
    const logger = app.get(Logger);
    logger.log('Running pending migrations...', 'Bootstrap');
    await ds.runMigrations();
    logger.log('Migrations complete', 'Bootstrap');
  }

  // Nginx forwards path as-is (proxy_pass với variable không auto-rewrite).
  // Backend serve routes under /api/*, giữ /health /ready ở root cho docker healthcheck.
  app.setGlobalPrefix('api', { exclude: ['health', 'ready', 'metrics'] });

  // Trust proxy = Nginx phía trước; cho phép req.ip đọc từ X-Forwarded-For (khi từ trusted proxy CIDR).
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`OneMCP backend listening on :${port} — mode=v1-trust-header`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Fatal boot error', err);
  process.exit(1);
});
