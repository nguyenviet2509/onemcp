/**
 * Unit tests for TemplateValidator — validate() coverage for report + research types.
 * Plan: 260730-1043-openwebui-wrapup-hook Phase 1.
 *
 * Tests run without NestJS module wiring — TemplateValidator is instantiated directly
 * with a mock ConfigService. All Ops-types flag checks go through ConfigService.get().
 *
 * Coverage:
 *  - report: valid payload, missing required field, field too short, flat vs nested shape
 *  - research: valid payload, missing required field (findings, conclusion), field too short
 *  - kb: untouched by this phase — single smoke test for backward-compat
 *  - ops gate: postmortem rejected when flag off
 */

import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TemplateValidator } from './template-validator';

// --- helpers ---

function makeConfig(opsEnabled: '0' | '1' = '0'): ConfigService {
  return {
    get: (_key: string, def = '') => {
      if (_key === 'ONEMCP_ENABLE_OPS_TYPES') return opsEnabled;
      return def;
    },
  } as unknown as ConfigService;
}

function makeValidator(opsEnabled: '0' | '1' = '0'): TemplateValidator {
  return new TemplateValidator(makeConfig(opsEnabled));
}

// ============================================================
// REPORT — session-summary schema (V2)
// Required: context (min 50), work_done (min 100), outcome (min 50)
// Optional: next_steps
// ============================================================

describe('TemplateValidator — report (V2 session-summary schema)', () => {
  const v = makeValidator();

  const VALID_REPORT = {
    context:
      'Người dùng báo lỗi login thất bại sau khi deploy. Cần điều tra ngay để tránh downtime.',
    work_done:
      'Kiểm tra logs Caddy + backend. Phát hiện JWT_SECRET bị rotate nhưng không sync sang container mới. ' +
      'Restart backend với secret mới. Verify login thành công trên staging trước khi release production.',
    outcome:
      'Login hoạt động bình thường. Downtime ~15 phút. Root cause ghi vào KB.',
  };

  it('accepts valid flat payload (all required + no next_steps)', () => {
    const { data, template } = v.validate('report', VALID_REPORT);
    expect(data.fields.context).toBe(VALID_REPORT.context);
    expect(data.fields.work_done).toBe(VALID_REPORT.work_done);
    expect(data.fields.outcome).toBe(VALID_REPORT.outcome);
    expect(data.fields.next_steps).toBeUndefined();
    expect(data.template_version).toBe(2);
    expect(template.type).toBe('report');
  });

  it('accepts nested {fields: {}} shape', () => {
    const { data } = v.validate('report', { fields: VALID_REPORT });
    expect(data.fields.context).toBe(VALID_REPORT.context);
  });

  it('accepts payload with optional next_steps', () => {
    const { data } = v.validate('report', {
      ...VALID_REPORT,
      next_steps: '- [ ] Thêm alert cho JWT secret rotation',
    });
    expect(data.fields.next_steps).toContain('alert');
  });

  it('rejects when context missing', () => {
    const { work_done, outcome } = VALID_REPORT;
    expect(() => v.validate('report', { work_done, outcome })).toThrow(BadRequestException);
    try {
      v.validate('report', { work_done, outcome });
    } catch (e) {
      const body = (e as BadRequestException).getResponse() as { errors: string[] };
      expect(body.errors.some((err) => err.includes('context'))).toBe(true);
    }
  });

  it('rejects when work_done missing', () => {
    const { context, outcome } = VALID_REPORT;
    expect(() => v.validate('report', { context, outcome })).toThrow(BadRequestException);
  });

  it('rejects when outcome missing', () => {
    const { context, work_done } = VALID_REPORT;
    expect(() => v.validate('report', { context, work_done })).toThrow(BadRequestException);
  });

  it('rejects context shorter than minLength 50', () => {
    expect(() =>
      v.validate('report', {
        ...VALID_REPORT,
        context: 'Too short.',  // < 50 chars
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects work_done shorter than minLength 100', () => {
    expect(() =>
      v.validate('report', {
        ...VALID_REPORT,
        work_done: 'Short work_done.',  // < 100 chars
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects outcome shorter than minLength 50', () => {
    expect(() =>
      v.validate('report', {
        ...VALID_REPORT,
        outcome: 'Too short.',  // < 50 chars
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects non-string field value', () => {
    expect(() =>
      v.validate('report', { ...VALID_REPORT, context: 123 }),
    ).toThrow(BadRequestException);
  });

  it('rejects empty string for required field', () => {
    expect(() =>
      v.validate('report', { ...VALID_REPORT, context: '   ' }),
    ).toThrow(BadRequestException);
  });

  it('compileBody produces markdown with all sections', () => {
    const { structured, body } = v.validateAndCompile('report', VALID_REPORT);
    expect(body).toContain('## Context');
    expect(body).toContain('## Work done');
    expect(body).toContain('## Outcome');
    // next_steps was not provided — should not appear in body
    expect(body).not.toContain('## Next steps');
    expect(structured.template_version).toBe(2);
  });
});

// ============================================================
// RESEARCH — hypothesis-driven schema (V2)
// Required: question (min 20), findings (min 200), conclusion (min 50)
// Optional: hypothesis, references
// ============================================================

describe('TemplateValidator — research (V2 hypothesis-driven schema)', () => {
  const v = makeValidator();

  const VALID_RESEARCH = {
    question:
      'Liệu pgvector IVFFlat index có tăng tốc độ semantic search lên ít nhất 5x so với sequential scan?',
    findings:
      'Test trên dataset 50k embeddings (dim=1536). Sequential scan: 850ms avg. IVFFlat (lists=100, probes=10): 120ms avg. ' +
      'Tốc độ tăng 7x. Recall@10 giảm từ 100% xuống 94% — chấp nhận được cho usecase search KB. ' +
      'CPU usage giảm 60% under load. Memory overhead của index: ~40MB. ' +
      'Kết luận: IVFFlat phù hợp cho production với dataset hiện tại.',
    conclusion:
      'IVFFlat index cho tốc độ tăng 7x với recall trade-off chấp nhận được. Deploy production.',
  };

  it('accepts valid payload (required fields only)', () => {
    const { data, template } = v.validate('research', VALID_RESEARCH);
    expect(data.fields.question).toBe(VALID_RESEARCH.question);
    expect(data.fields.findings).toBe(VALID_RESEARCH.findings);
    expect(data.fields.conclusion).toBe(VALID_RESEARCH.conclusion);
    expect(data.fields.hypothesis).toBeUndefined();
    expect(data.fields.references).toBeUndefined();
    expect(data.template_version).toBe(2);
    expect(template.type).toBe('research');
  });

  it('accepts payload with all optional fields', () => {
    const { data } = v.validate('research', {
      ...VALID_RESEARCH,
      hypothesis: 'IVFFlat sẽ nhanh hơn ít nhất 3x dựa trên benchmark từ pgvector docs.',
      references: '- https://github.com/pgvector/pgvector\n- https://ann-benchmarks.com',
    });
    expect(data.fields.hypothesis).toContain('IVFFlat');
    expect(data.fields.references).toContain('pgvector');
  });

  it('accepts nested {fields: {}} shape', () => {
    const { data } = v.validate('research', { fields: VALID_RESEARCH });
    expect(data.fields.question).toBe(VALID_RESEARCH.question);
  });

  it('rejects when question missing', () => {
    const { findings, conclusion } = VALID_RESEARCH;
    expect(() => v.validate('research', { findings, conclusion })).toThrow(BadRequestException);
  });

  it('rejects when findings missing', () => {
    const { question, conclusion } = VALID_RESEARCH;
    expect(() => v.validate('research', { question, conclusion })).toThrow(BadRequestException);
  });

  it('rejects when conclusion missing', () => {
    const { question, findings } = VALID_RESEARCH;
    expect(() => v.validate('research', { question, findings })).toThrow(BadRequestException);
  });

  it('rejects question shorter than minLength 20', () => {
    expect(() =>
      v.validate('research', {
        ...VALID_RESEARCH,
        question: 'Too short?',  // < 20 chars
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects findings shorter than minLength 200', () => {
    // Generate a string just under 200 chars.
    const shortFindings = 'Findings are too short. Need at least 200 characters to be valid.';
    expect(shortFindings.length).toBeLessThan(200);
    expect(() =>
      v.validate('research', { ...VALID_RESEARCH, findings: shortFindings }),
    ).toThrow(BadRequestException);
  });

  it('rejects conclusion shorter than minLength 50', () => {
    expect(() =>
      v.validate('research', {
        ...VALID_RESEARCH,
        conclusion: 'Too short.',  // < 50 chars
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects question longer than maxLength 500', () => {
    const longQuestion = 'Q'.repeat(501);
    expect(() =>
      v.validate('research', { ...VALID_RESEARCH, question: longQuestion }),
    ).toThrow(BadRequestException);
  });

  it('compileBody includes all provided sections', () => {
    const { body } = v.validateAndCompile('research', {
      ...VALID_RESEARCH,
      hypothesis: 'IVFFlat sẽ nhanh hơn ít nhất 3x.',
    });
    expect(body).toContain('## Research question');
    expect(body).toContain('## Hypothesis');
    expect(body).toContain('## Findings');
    expect(body).toContain('## Conclusion');
    expect(body).not.toContain('## References');  // not provided
  });
});

// ============================================================
// KB — backward-compat smoke test (V1 untouched)
// ============================================================

describe('TemplateValidator — kb (V1 backward-compat)', () => {
  const v = makeValidator();

  it('still validates kb template correctly', () => {
    const { data } = v.validate('kb', {
      problem: 'Jest hangs after test run. No explicit exit. All tests pass.',
      solution:
        'Add --forceExit flag to jest command or call jest.clearAllTimers() in afterAll.\n' +
        'Root cause: open handles (setInterval, unclosed DB connections).',
    });
    expect(data.fields.problem).toBeDefined();
    expect(data.fields.solution).toBeDefined();
    expect(data.template_version).toBe(1);
  });

  it('rejects kb with missing required solution field', () => {
    expect(() =>
      v.validate('kb', {
        problem: 'Error: ECONNREFUSED 127.0.0.1:5432 — postgres not reachable from backend.',
      }),
    ).toThrow(BadRequestException);
  });
});

// ============================================================
// Ops-type gate (postmortem gated behind feature flag)
// ============================================================

describe('TemplateValidator — ops-type gate', () => {
  it('rejects postmortem when ONEMCP_ENABLE_OPS_TYPES=0', () => {
    const v = makeValidator('0');
    expect(() =>
      v.validate('postmortem', {
        summary: 'Test incident',
        timeline: '14:00 — alert fired',
        root_cause: 'Misconfiguration',
        action_items: '- [ ] Fix it',
      }),
    ).toThrow(BadRequestException);
  });

  it('allows postmortem when ONEMCP_ENABLE_OPS_TYPES=1', () => {
    const v = makeValidator('1');
    // Should not throw (may have validation errors on content but not the gate).
    const result = v.validate('postmortem', {
      summary: 'Auth service outage — JWT_SECRET not synced after rotate.',
      timeline: '14:00 — alert fired\n14:15 — root cause found\n14:30 — mitigated',
      root_cause: 'JWT_SECRET rotation not reflected in running containers due to missing env sync.',
      action_items: '- [ ] Add secret rotation runbook\n- [ ] Alert on secret age > 30d',
    });
    expect(result.data.template_version).toBe(1);
  });
});

// ============================================================
// Unknown type
// ============================================================

describe('TemplateValidator — unknown type', () => {
  it('throws 400 for unregistered type', () => {
    const v = makeValidator();
    expect(() =>
      v.validate('nonexistent' as never, { foo: 'bar' }),
    ).toThrow(BadRequestException);
  });
});
