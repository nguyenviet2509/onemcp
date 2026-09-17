import { z } from 'zod';
import { KNOWN_MCP_TOOLS } from '../../mcp/mcp-args-redactor';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;

// Static tool names that cannot be used as bridge names — a bridge with the same
// name would silently shadow the built-in, breaking core MCP functionality.
const RESERVED_TOOL_NAMES: ReadonlySet<string> = new Set(KNOWN_MCP_TOOLS);

const bridgeNameField = z.string().min(1).max(64).refine(
  (name) => !RESERVED_TOOL_NAMES.has(name),
  (name) => ({ message: `Bridge name '${name}' collides with built-in static tool` }),
);

export const createBridgeSchema = z.object({
  upstreamId: z.string().uuid(),
  name: bridgeNameField,
  description: z.string().min(1),
  method: z.enum(HTTP_METHODS),
  path: z.string().min(1).max(512),
  paramSchema: z.record(z.unknown()),
  permissionId: z.string().min(1).max(128),
  enabled: z.boolean().default(true),
}).strict();

export const updateBridgeSchema = z.object({
  upstreamId: z.string().uuid().optional(),
  name: bridgeNameField.optional(),
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
