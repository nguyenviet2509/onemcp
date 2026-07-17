import { z } from 'zod';
import { ARTIFACT_TYPES } from '../artifact-type.enum';

// Payload validation cho create + MCP submit_artifact tool.
// Body 2MB cap enforce ở đây (~2M chars — chấp nhận rough approx).
// body optional nếu structured cung cấp — service.prepareContent() sẽ compile body từ template.
// Nếu cả hai empty → service throw.
export const submitArtifactSchema = z.object({
  type: z.enum(ARTIFACT_TYPES),
  title: z.string().min(3).max(255),
  slug: z
    .string()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase alphanumeric + dashes'),
  body: z.string().max(2_000_000).optional(),
  structured: z.record(z.unknown()).optional(),
  tags: z.array(z.string().min(1).max(32)).max(20).optional().default([]),
});

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
