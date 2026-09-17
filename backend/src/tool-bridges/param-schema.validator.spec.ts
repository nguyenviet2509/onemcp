/**
 * Unit tests for ParamSchemaValidator — meta-validate JSON Schema param_schema field.
 * Covers: valid object schema, missing type:'object', non-object value, extra fields pass-through.
 */
import { BadRequestException } from '@nestjs/common';
import { ParamSchemaValidator } from './param-schema.validator';

describe('ParamSchemaValidator', () => {
  let validator: ParamSchemaValidator;

  beforeEach(() => {
    validator = new ParamSchemaValidator();
  });

  it('accepts valid object schema with properties', () => {
    const schema = {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'hostname' },
        port: { type: 'integer' },
      },
      required: ['host'],
    };
    expect(() => validator.validate(schema)).not.toThrow();
    expect(validator.validate(schema)).toBe(schema);
  });

  it('accepts minimal object schema (no properties)', () => {
    const schema = { type: 'object' };
    expect(() => validator.validate(schema)).not.toThrow();
  });

  it('rejects schema without type field', () => {
    const schema = { properties: { host: { type: 'string' } } };
    expect(() => validator.validate(schema)).toThrow(BadRequestException);
  });

  it('rejects schema with type != "object"', () => {
    const schema = { type: 'array', items: { type: 'string' } };
    expect(() => validator.validate(schema)).toThrow(BadRequestException);
  });

  it('rejects non-object value (array)', () => {
    expect(() => validator.validate([] as unknown as Record<string, unknown>)).toThrow(BadRequestException);
  });

  it('allows additionalProperties boolean', () => {
    const schema = { type: 'object', additionalProperties: false };
    expect(() => validator.validate(schema)).not.toThrow();
  });

  it('allows extra JSON Schema keywords (passthrough)', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      '$schema': 'http://json-schema.org/draft-07/schema#',
    };
    expect(() => validator.validate(schema)).not.toThrow();
  });
});
