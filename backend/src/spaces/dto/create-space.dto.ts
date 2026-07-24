import { z } from 'zod';

// DTO for creating a space — validated via zod (consistent with existing patterns).
export const createSpaceSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase alphanumeric + dashes only'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  departmentId: z.string().optional(),
  icon: z.string().max(32).optional(),
  visibility: z.enum(['space', 'dept', 'cross_dept']).default('space'),
});

export const updateSpaceSchema = createSpaceSchema.partial();

export type CreateSpaceDto = z.infer<typeof createSpaceSchema>;
export type UpdateSpaceDto = z.infer<typeof updateSpaceSchema>;
