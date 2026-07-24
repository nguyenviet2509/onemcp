import { z } from 'zod';
import { ARTIFACT_TYPES } from '../artifact-type.enum';

// Payload validation cho create + MCP submit_artifact tool.
// Body 2MB cap enforce ở đây (~2M chars — chấp nhận rough approx).
// body optional nếu structured cung cấp — service.prepareContent() sẽ compile body từ template.
// Nếu cả hai empty → service throw.
// Phase 1C: template_key + space slug are optional; backward compat with type-only callers preserved.
export const submitArtifactSchema = z.object({
  // Deprecated: use template_key. Kept for 1-release backward compat. Optional if template_key provided.
  type: z.enum(ARTIFACT_TYPES).optional(),
  // Phase 1C: preferred over type. Must reference active template in DB.
  template_key: z.string().min(1).max(64).optional(),
  // Phase 1C: space slug. Must exist in spaces table. Resolved to space_id before DB write.
  space: z.string().min(1).max(64).optional(),
  // Internal: resolved space_id (set by MCP tool after slug lookup, not from client directly).
  space_id: z.string().optional(),
  title: z.string().min(3).max(255),
  slug: z
    .string()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase alphanumeric + dashes'),
  body: z.string().max(2_000_000).optional(),
  structured: z.record(z.unknown()).optional(),
  tags: z.array(z.string().min(1).max(32)).max(20).optional().default([]),
}).refine(
  (d) => d.type != null || d.template_key != null,
  { message: 'type hoặc template_key phải được cung cấp', path: ['type'] },
);

export type SubmitArtifactDto = z.infer<typeof submitArtifactSchema>;

export const reviewArtifactSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(1000).optional(),
});

export type ReviewArtifactDto = z.infer<typeof reviewArtifactSchema>;

// Update flow: submit new pending version. Optimistic lock qua expected_version_no
// — client phải gửi latest version_no đã thấy; nếu server có version mới hơn → 409.
export const updateArtifactSchema = z.object({
  expected_version_no: z.number().int().min(1),
  body: z.string().max(2_000_000).optional(),
  structured: z.record(z.unknown()).optional(),
  tags: z.array(z.string().min(1).max(32)).max(20).optional(),
});

export type UpdateArtifactDto = z.infer<typeof updateArtifactSchema>;
