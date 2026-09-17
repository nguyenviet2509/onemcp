import { z } from 'zod';

// Strict schemas — reject unknown fields via .strict().
// bearer masked as "***" in all response shapes (never return ciphertext or plaintext).

export const createUpstreamSchema = z.object({
  name: z.string().min(1).max(64),
  baseUrl: z.string().url().max(512),
  bearer: z.string().min(1),
  timeoutMs: z.number().int().min(100).max(120_000).default(10000),
  enabled: z.boolean().default(true),
}).strict();

export const updateUpstreamSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  baseUrl: z.string().url().max(512).optional(),
  bearer: z.string().min(1).optional(),
  timeoutMs: z.number().int().min(100).max(120_000).optional(),
  enabled: z.boolean().optional(),
}).strict();

export const upstreamResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  baseUrl: z.string(),
  bearer: z.literal('***'),
  timeoutMs: z.number(),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CreateUpstreamDto = z.infer<typeof createUpstreamSchema>;
export type UpdateUpstreamDto = z.infer<typeof updateUpstreamSchema>;
export type UpstreamResponse = z.infer<typeof upstreamResponseSchema>;
