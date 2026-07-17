import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OPS_ARTIFACT_TYPES, ArtifactType } from '../artifact-type.enum';
import { getTemplate, Template, TemplateField } from './template-registry';

export interface StructuredContent {
  template_version: number;
  fields: Record<string, string>;
}

@Injectable()
export class TemplateValidator {
  constructor(private readonly config: ConfigService) {}

  // Kiểm tra feature flag ONEMCP_ENABLE_OPS_TYPES cho postmortem/runbook submit.
  // List/get vẫn hoạt động khi flag off — chỉ gate submit.
  private isOpsTypesEnabled(): boolean {
    return this.config.get<string>('ONEMCP_ENABLE_OPS_TYPES', '0') === '1';
  }

  // Validate structured payload theo template. Return normalized structured hoặc throw 400.
  // Trả về template được dùng để caller có thể compile body.
  validate(type: ArtifactType, structured: unknown): { data: StructuredContent; template: Template } {
    // Gate ops artifact types sau feature flag (V8).
    if (OPS_ARTIFACT_TYPES.includes(type) && !this.isOpsTypesEnabled()) {
      throw new BadRequestException('Ops artifact types disabled');
    }

    const template = getTemplate(type);
    if (!template) throw new BadRequestException(`Unknown artifact type "${type}"`);

    if (structured === undefined || structured === null || typeof structured !== 'object') {
      throw new BadRequestException(`structured is required and must be an object`);
    }
    const raw = structured as Record<string, unknown>;

    // Accept both shapes: {template_version, fields:{}} hoặc flat {key: value}.
    const flat: Record<string, unknown> =
      raw.fields && typeof raw.fields === 'object' ? (raw.fields as Record<string, unknown>) : raw;

    const errors: string[] = [];
    const normalized: Record<string, string> = {};
    for (const field of template.fields) {
      const value = flat[field.key];
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        if (field.required) errors.push(`${field.key}: required`);
        continue;
      }
      if (typeof value !== 'string') {
        errors.push(`${field.key}: must be string`);
        continue;
      }
      // minLength retained for non-ops types (report/research/kb). Ops types drop minLength (V6).
      if (field.minLength && value.length < field.minLength) {
        errors.push(`${field.key}: minLength ${field.minLength}`);
      }
      if (field.maxLength && value.length > field.maxLength) {
        errors.push(`${field.key}: maxLength ${field.maxLength}`);
      }
      normalized[field.key] = value;
    }

    // Warn (không throw) nếu có key không thuộc template — schema drift.
    for (const key of Object.keys(flat)) {
      if (!template.fields.find((f) => f.key === key)) {
        // Ignore unknown keys — không strict để cho phép custom fields tương lai.
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Invalid structured content', errors });
    }
    return {
      data: { template_version: template.version, fields: normalized },
      template,
    };
  }

  // Compile structured → markdown body dùng làm search index + fallback render.
  // type=logs compile thành ```log fence block (V7).
  compileBody(template: Template, structured: StructuredContent): string {
    const parts: string[] = [];
    for (const field of template.fields) {
      const val = structured.fields[field.key];
      if (val === undefined) continue;
      if (field.type === 'logs') {
        // V7: logs field → ```log fence. Portal renders fenced blocks correctly already.
        parts.push(`## ${field.label}\n\n\`\`\`log\n${val.trim()}\n\`\`\``);
      } else {
        parts.push(`## ${field.label}\n\n${val.trim()}`);
      }
    }
    return parts.join('\n\n');
  }

  // Validate + compile helper.
  validateAndCompile(type: ArtifactType, structured: unknown): { structured: StructuredContent; body: string } {
    const { data, template } = this.validate(type, structured);
    return { structured: data, body: this.compileBody(template, data) };
  }

  // Fields list helper cho controllers/portal.
  fieldsFor(type: ArtifactType): TemplateField[] {
    return getTemplate(type).fields;
  }
}
