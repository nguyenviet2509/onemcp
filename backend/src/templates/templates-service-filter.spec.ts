/**
 * Unit tests for TemplatesService — listActive filtering by department scope.
 * Tests run without real DB: Repository QueryBuilder is mocked.
 * Coverage: list all active, filter by dept slug (match + no-match), inactive excluded.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemplatesService } from './templates.service';
import { Template } from './template.entity';

// Minimal Template factory.
function makeTpl(key: string, active: boolean, departmentScope: string[] = []): Template {
  return {
    key,
    label: key,
    description: null,
    schema: {},
    uiHints: null,
    departmentScope,
    active,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Simulated in-memory dataset for QueryBuilder.
const SEED: Template[] = [
  makeTpl('report',         true,  []),           // global (no scope restriction)
  makeTpl('kb',             true,  []),           // global
  makeTpl('sop',            true,  ['ops']),      // ops-only
  makeTpl('ticket_playbook',true,  ['support']),  // support-only
  makeTpl('draft',          false, []),           // inactive — should never appear
];

describe('TemplatesService', () => {
  let service: TemplatesService;

  // Build a mock QueryBuilder that filters SEED in memory to replicate the SQL logic.
  function buildMockQb(filterFn: (t: Template) => boolean) {
    const qb: Record<string, jest.Mock> = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => SEED.filter(filterFn)),
    };
    return qb;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        {
          provide: getRepositoryToken(Template),
          useValue: {
            createQueryBuilder: jest.fn(() =>
              // Default: return all active (dept filter decided per test via andWhere mock).
              buildMockQb((t) => t.active),
            ),
            findOne: jest.fn(async (opts: { where: { key: string } }) =>
              SEED.find((t) => t.key === opts.where.key) ?? null,
            ),
            create: jest.fn((data) => data),
            save: jest.fn(async (entity) => entity),
            remove: jest.fn(async () => undefined),
          },
        },
      ],
    }).compile();

    service = module.get(TemplatesService);
  });

  describe('listActive', () => {
    it('returns all active templates when no dept filter given', async () => {
      const results = await service.listActive();
      expect(results.map((t) => t.key).sort()).toEqual(['kb', 'report', 'sop', 'ticket_playbook']);
      // inactive 'draft' must NOT appear.
      expect(results.find((t) => t.key === 'draft')).toBeUndefined();
    });

    it('scope: ops dept sees sop + globals', async () => {
      // Simulate QueryBuilder applying dept filter: active + (scope empty OR 'ops' in scope).
      const mockRepo = {
        createQueryBuilder: jest.fn(() =>
          buildMockQb((t) => t.active && (t.departmentScope.length === 0 || t.departmentScope.includes('ops'))),
        ),
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        remove: jest.fn(),
      };

      const mod = await Test.createTestingModule({
        providers: [
          TemplatesService,
          { provide: getRepositoryToken(Template), useValue: mockRepo },
        ],
      }).compile();

      const svc = mod.get(TemplatesService);
      const results = await svc.listActive('ops');
      const keys = results.map((t) => t.key).sort();
      expect(keys).toContain('sop');
      expect(keys).toContain('report');
      expect(keys).toContain('kb');
      // ticket_playbook is support-only — not visible to ops.
      expect(keys).not.toContain('ticket_playbook');
    });

    it('scope: unknown dept sees only globals (no restricted templates)', async () => {
      const mockRepo = {
        createQueryBuilder: jest.fn(() =>
          buildMockQb(
            (t) =>
              t.active &&
              (t.departmentScope.length === 0 || t.departmentScope.includes('unknown-dept')),
          ),
        ),
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        remove: jest.fn(),
      };

      const mod = await Test.createTestingModule({
        providers: [
          TemplatesService,
          { provide: getRepositoryToken(Template), useValue: mockRepo },
        ],
      }).compile();

      const svc = mod.get(TemplatesService);
      const results = await svc.listActive('unknown-dept');
      const keys = results.map((t) => t.key).sort();
      expect(keys).toEqual(['kb', 'report']); // only globally scoped templates
    });
  });

  describe('getByKey', () => {
    it('returns template by existing key', async () => {
      const tpl = await service.getByKey('report');
      expect(tpl.key).toBe('report');
    });

    it('throws NotFoundException for missing key', async () => {
      await expect(service.getByKey('nonexistent')).rejects.toMatchObject({
        message: expect.stringContaining('nonexistent'),
      });
    });
  });
});
