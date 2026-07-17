import { z } from 'zod';

// Skill manifest schema — validated ở CI (skills repo) và runtime (webhook consumer).
// Static-only v1: KHÔNG cho phép `execute` permission (C1 mitigation).
// Manifest versioning: `manifest_version` cho phép rolling upgrade sau.
export const skillManifestSchema = z.object({
  manifest_version: z.literal(1),
  name: z
    .string()
    .min(2)
    .max(128)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'name = lowercase alphanumeric + dashes'),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/, 'semver format required'),
  department: z.string().min(1),
  description: z.string().min(10).max(500),
  tags: z.array(z.string().min(1).max(32)).max(20).default([]),
  entrypoint: z.string().default('SKILL.md'),
  resources: z.array(z.string()).max(50).default([]),
  // Static-only v1 — permissions bị bó chỉ đọc.
  // Reject nếu manifest có `execute` hoặc scope khác không whitelist.
  permissions: z
    .array(z.enum(['read']))
    .max(1)
    .default([]),
  authors: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
      }),
    )
    .default([]),
});

export type SkillManifest = z.infer<typeof skillManifestSchema>;

// Max supported manifest_version. Reject nếu vượt.
export const MAX_MANIFEST_VERSION = 1;
