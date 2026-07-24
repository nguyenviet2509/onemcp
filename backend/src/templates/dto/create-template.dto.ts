import { z } from 'zod';

export const createTemplateSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'lowercase alphanumeric + underscores only'),
  label: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  schema: z.record(z.unknown()).default({}),
  uiHints: z.record(z.unknown()).optional(),
  departmentScope: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export const updateTemplateSchema = createTemplateSchema.omit({ key: true }).partial();

export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;
