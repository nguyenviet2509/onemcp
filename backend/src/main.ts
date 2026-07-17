import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.schema';

async function bootstrap() {
  // Fail fast on invalid env before Nest boots.
  validateEnv(process.env);

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Backend runs behind nginx which strips /api prefix.
  app.setGlobalPrefix('', { exclude: ['/health', '/ready'] });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`OneMCP backend listening on :${port} — mode=v1-trust-header`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Fatal boot error', err);
  process.exit(1);
});
