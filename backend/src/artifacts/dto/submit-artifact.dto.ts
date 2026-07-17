import { z } from 'zod';
import { ARTIFACT_TYPES } from '../artifact-type.enum';

// Payload validation cho create + MCP submit_artifact tool.
// Body 2MB cap enforce ở đây (~2M chars — chấp nhận rough approx).
export const submitArtifactSchema = z.object({
  type: z.enum(ARTIFACT_TYPES),
  title: z.string().min(3).max(255),
  slug: z
    .string()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase alphanumeric + dashes'),
  body: z.string().min(1).max(2_000_000),
  structured: z.record(z.unknown()).optional().default({}),
  tags: z.array(z.string().min(1).max(32)).max(20).optional().default([]),
});

export type SubmitArtifactDto = z.infer<typeof submitArtifactSchema>;

export const reviewArtifactSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(1000).optional(),
});

export type ReviewArtifactDto = z.infer<typeof reviewArtifactSchema>;
