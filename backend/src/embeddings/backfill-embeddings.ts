/**
 * Backfill script — enqueues embed jobs for all published artifacts missing embeddings.
 * Run after deploy + migrations: `npm run backfill:embeddings`
 * Rate-limited: 50ms sleep between enqueues to avoid queue flood.
 * Does NOT run migrations, does NOT call TEI directly — only enqueues BullMQ jobs.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { EmbedArtifactQueue } from './embed-artifact.queue';
import { buildArtifactEmbedText } from './artifact-embed-text.util';

const SLEEP_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });

  const ds = app.get(DataSource);
  const queue = app.get(EmbedArtifactQueue);

  // Find published artifact versions that have no embedding yet.
  const rows: Array<{ version_id: string; title: string; body: string; tags: string[] }> = await ds.query(`
    SELECT
      av.id            AS version_id,
      a.title          AS title,
      av.body          AS body,
      a.tags           AS tags
    FROM artifact_versions av
    JOIN artifacts a ON a.id = av.artifact_id
    LEFT JOIN embeddings e ON e.artifact_version_id = av.id
    WHERE a.status = 'published'
      AND a.current_version_id = av.id
      AND e.artifact_version_id IS NULL
    ORDER BY a.updated_at ASC
  `);

  console.log(`Found ${rows.length} published artifacts missing embeddings.`);
  if (rows.length === 0) {
    await app.close();
    return;
  }

  let enqueued = 0;
  for (const row of rows) {
    const text = [row.title, row.body, (row.tags ?? []).join(' ')].join('\n').slice(0, 2000);
    try {
      await queue.enqueue({ artifactVersionId: row.version_id, text });
      enqueued++;
    } catch (err) {
      console.error(`Failed to enqueue versionId=${row.version_id}: ${(err as Error).message}`);
    }
    await sleep(SLEEP_MS);
  }

  console.log(`Backfill complete: ${enqueued}/${rows.length} jobs enqueued.`);
  await app.close();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
