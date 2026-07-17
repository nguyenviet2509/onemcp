import { z } from 'zod';

// Runtime env validation for OneMCP backend.
// Fails fast at boot if any critical variable missing or malformed.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Postgres
  POSTGRES_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // MinIO (used in P3, present now for validation)
  MINIO_ENDPOINT: z.string().url(),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(8),

  // Access control (v1 defer auth)
  USER_ALLOW_CIDR: z.string().min(1),
  ADMIN_ALLOW_CIDR: z.string().min(1),
  TRUSTED_PROXY_CIDR: z.string().default('127.0.0.1/32'),
  TRUST_USER_HEADER: z.string().default('X-Onemcp-User'),
  DEFAULT_ROLE: z.enum(['viewer', 'contributor', 'maintainer', 'dept-admin', 'super-admin']).default('contributor'),
  MAINTAINER_USERNAMES: z.string().default(''),
  ADMIN_USERNAMES: z.string().default(''),
  EMERGENCY_LOCKDOWN: z.coerce.boolean().default(false),

  // Storage paths
  GIT_MIRROR_ROOT: z.string().default('/var/lib/onemcp/mirrors'),

  // GitLab skill sync (P2). GITLAB_BASE_URL rỗng = disable webhook processing,
  // vẫn cho phép manual trigger để test integration.
  GITLAB_BASE_URL: z.string().default(''),
  GITLAB_WEBHOOK_SECRET: z.string().default(''),
  GITLAB_MIRROR_TOKEN: z.string().default(''),
  SKILLS_MONO_REPO: z.string().default('onemcp/skills-kythuat'),
  SKILLS_MONO_BRANCH: z.string().default('main'),
  SKILL_SYNC_CRON: z.string().default('*/15 * * * *'),
  SKILL_APPROVE_RATE_LIMIT: z.coerce.number().default(20),

  // Observability
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('Invalid environment configuration:');
    for (const err of parsed.error.errors) {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}
