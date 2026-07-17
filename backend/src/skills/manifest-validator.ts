import { BadRequestException, Injectable } from '@nestjs/common';
import { MAX_MANIFEST_VERSION, SkillManifest, skillManifestSchema } from './manifest-schema';

export interface ManifestValidationResult {
  valid: true;
  data: SkillManifest;
}

export interface ManifestValidationError {
  valid: false;
  errors: { path: string; message: string }[];
}

@Injectable()
export class ManifestValidator {
  validate(raw: unknown): ManifestValidationResult | ManifestValidationError {
    // Reject early nếu vượt max supported version — không parse tiếp.
    if (
      raw &&
      typeof raw === 'object' &&
      'manifest_version' in raw &&
      typeof (raw as Record<string, unknown>).manifest_version === 'number' &&
      ((raw as Record<string, unknown>).manifest_version as number) > MAX_MANIFEST_VERSION
    ) {
      return {
        valid: false,
        errors: [
          {
            path: 'manifest_version',
            message: `manifest_version > ${MAX_MANIFEST_VERSION} — upgrade OneMCP backend`,
          },
        ],
      };
    }

    const parsed = skillManifestSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        valid: false,
        errors: parsed.error.errors.map((e) => ({
          path: e.path.join('.') || '(root)',
          message: e.message,
        })),
      };
    }
    return { valid: true, data: parsed.data };
  }

  // Convenience: throw BadRequest với error detail.
  validateOrThrow(raw: unknown): SkillManifest {
    const result = this.validate(raw);
    if (!result.valid) {
      throw new BadRequestException({
        message: 'Invalid skill manifest',
        errors: result.errors,
      });
    }
    return result.data;
  }
}
