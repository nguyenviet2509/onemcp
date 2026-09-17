import { z } from 'zod';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;

export const createBridgeSchema = z.object({
  upstreamId: z.string().uuid(),
  name: z.string().min(1).max(64),
  description: z.string().min(1),
  method: z.enum(HTTP_METHODS),
  path: z.string().min(1).max(512),
  paramSchema: z.record(z.unknown()),
  permissionId: z.string().min(1).max(128),
  enabled: z.boolean().default(true),
}).strict();

export const updateBridgeSchema = z.object({
  upstreamId: z.string().uuid().optional(),
  name: z.string().min(1).max(64).optional(),
  description: z.string().min(1).optional(),
  method: z.enum(HTTP_METHODS).optional(),
  path: z.string().min(1).max(512).optional(),
  paramSchema: z.record(z.unknown()).optional(),
  permissionId: z.string().min(1).max(128).optional(),
  enabled: z.boolean().optional(),
}).strict();

export const bridgeResponseSchema = z.object({
  id: z.string().uuid(),
  upstreamId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  method: z.enum(HTTP_METHODS),
  path: z.string(),
  paramSchema: z.record(z.unknown()),
  permissionId: z.string(),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CreateBridgeDto = z.infer<typeof createBridgeSchema>;
export type UpdateBridgeDto = z.infer<typeof updateBridgeSchema>;
export type BridgeResponse = z.infer<typeof bridgeResponseSchema>;
