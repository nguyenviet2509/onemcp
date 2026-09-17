import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';

// JSON Schema meta-validator for tool bridge param_schema field.
// Requirement: root must be type:'object' with properties defined.
// Uses Zod structural check (no ajv dep required — ajv not in project deps).
// Rejects anything that isn't a plain object JSON Schema descriptor.

const jsonSchemaPrimitiveTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'] as const;

const paramSchemaMetaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(
    z.object({
      type: z.enum(jsonSchemaPrimitiveTypes).optional(),
      description: z.string().optional(),
    }).passthrough(),
  ).optional(),
  required: z.array(z.string()).optional(),
  additionalProperties: z.boolean().optional(),
}).passthrough();

@Injectable()
export class ParamSchemaValidator {
  // Throws BadRequestException if schema is invalid.
  // Returns the validated schema (pass-through for chaining).
  validate(schema: Record<string, unknown>): Record<string, unknown> {
    const result = paramSchemaMetaSchema.safeParse(schema);
    if (!result.success) {
      throw new BadRequestException(
        `param_schema must be a valid JSON Schema object with root type:'object'. Errors: ${result.error.message}`,
      );
    }
    return schema;
  }
}
