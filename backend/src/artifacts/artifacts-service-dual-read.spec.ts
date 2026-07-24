/**
 * Unit tests for ArtifactsService dual-read logic (Phase 1C).
 *
 * Dual-read contract:
 *  - Write: both `type` (backward-compat) and `templateKey` persisted.
 *  - Read (list filter): accepts templateKey OR type interchangeably via OR clause.
 *  - resolveEffectiveType: template_key 'sop'|'faq'|'ticket_playbook' → 'report' fallback;
 *    known keys ('kb', 'runbook', etc.) map directly.
 *
 * Tests avoid wiring real DB — DataSource.transaction and Repositories are mocked.
 * ArtifactsService deps: Artifact repo, ArtifactVersion repo, RunbookLoadEvent repo,
 * DataSource, TemplateValidator, MetricsService, ConfigService.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ArtifactsService } from './artifacts.service';
import { Artifact } from './entities/artifact.entity';
import { ArtifactVersion } from './entities/artifact-version.entity';
import { RunbookLoadEvent } from './entities/runbook-load-event.entity';
import { TemplateValidator } from './templates/template-validator';
import { MetricsService } from '../metrics/metrics.service';
import { RequestUser } from '../common/user-request';

// ---- mock helpers ----

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 1,
    username: 'alice',
    departmentId: 10,
    roles: ['contributor'],
    status: 'active',
    claimedFromHeader: true,
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: '100',
    type: 'kb',
    templateKey: 'kb',
    spaceId: null,
    visibility: 'space',
    viewCount: 0,
    lastViewedAt: null,
    title: 'Test KB',
    slug: 'test-kb',
    departmentId: 10,
    ownerId: 1,
    currentVersionId: null,
    status: 'pending',
    tags: [],
    service: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Build a full mock QueryBuilder that returns `rows` from getMany/getOne.
function makeQb(rows: Artifact[]) {
  const qb: Record<string, jest.Mock> = {};
  const chainable = [
    'where', 'andWhere', 'orderBy', 'limit',
  ] as const;
  for (const m of chainable) {
    qb[m] = jest.fn().mockReturnThis();
  }
  qb['getMany'] = jest.fn(async () => rows);
  qb['getOne'] = jest.fn(async () => rows[0] ?? null);
  return qb;
}

describe('ArtifactsService — dual-read', () => {
  let service: ArtifactsService;
  let artifactRepo: { createQueryBuilder: jest.Mock; findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let versionRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let mockDs: { transaction: jest.Mock };

  beforeEach(async () => {
    artifactRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (e) => e),
      create: jest.fn((data) => data),
    };

    versionRepo = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (e) => ({ ...e, id: '200' })),
      create: jest.fn((data) => data),
    };

    // DataSource.transaction executes the callback with a mock manager.
    mockDs = {
      transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => {
        const mgr = {
          getRepository: jest.fn((entity) => {
            if (entity === Artifact) return artifactRepo;
            if (entity === ArtifactVersion) return versionRepo;
            return {};
          }),
        };
        return cb(mgr);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArtifactsService,
        { provide: getRepositoryToken(Artifact),           useValue: artifactRepo },
        { provide: getRepositoryToken(ArtifactVersion),    useValue: versionRepo },
        { provide: getRepositoryToken(RunbookLoadEvent),   useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: DataSource,                             useValue: mockDs },
        {
          provide: TemplateValidator,
          useValue: {
            validateAndCompile: jest.fn((type: string, structured: Record<string, unknown>) => ({
              body: 'compiled-body',
              structured,
            })),
          },
        },
        {
          provide: MetricsService,
          useValue: { artifactSubmits: { inc: jest.fn() }, runbookLoads: { inc: jest.fn() } },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def = '') => def) },
        },
      ],
    }).compile();

    service = module.get(ArtifactsService);
  });

  // ------------------------------------------------------------------ create dual-write

  describe('create — dual-write (template_key + type both persisted)', () => {
    it('write with template_key=kb: saves templateKey=kb AND type=kb', async () => {
      const user = makeUser();
      const dto = { template_key: 'kb', title: 'Test KB', slug: 'test-kb', body: 'hello kb', tags: [] };
      await service.create(user, dto as Parameters<typeof service.create>[1]);

      const saved = (artifactRepo.save as jest.Mock).mock.calls[0][0];
      expect(saved.templateKey).toBe('kb');
      expect(saved.type).toBe('kb'); // resolveEffectiveType('kb', null) = 'kb'
    });

    it('write with template_key=sop (new key not in legacy enum): saves templateKey=sop, type=report (fallback)', async () => {
      const user = makeUser();
      const dto = { template_key: 'sop', title: 'Test SOP', slug: 'test-sop', body: 'sop body', tags: [] };
      await service.create(user, dto as Parameters<typeof service.create>[1]);

      const saved = (artifactRepo.save as jest.Mock).mock.calls[0][0];
      expect(saved.templateKey).toBe('sop');
      // 'sop' not in KNOWN_ARTIFACT_TYPE_SET → fallback to 'report'
      expect(saved.type).toBe('report');
    });

    it('write with type=runbook (legacy client, no template_key): templateKey mirrors type', async () => {
      const user = makeUser();
      const dto = { type: 'runbook', title: 'DB Runbook', slug: 'db-runbook', body: 'runbook body', tags: [] };
      await service.create(user, dto as Parameters<typeof service.create>[1]);

      const saved = (artifactRepo.save as jest.Mock).mock.calls[0][0];
      // resolveEffectiveType(null, 'runbook') = 'runbook'; templateKey = null ?? effectiveType = 'runbook'
      expect(saved.type).toBe('runbook');
      expect(saved.templateKey).toBe('runbook');
    });
  });

  // ------------------------------------------------------------------ list dual-read filter

  describe('list — dual-read filter (templateKey OR type)', () => {
    it('filtering by templateKey=kb matches rows stored with type=kb (backward-compat rows)', async () => {
      // Simulate DB returning rows where template_key='kb' OR type='kb'.
      const mockRows = [makeArtifact({ templateKey: 'kb', type: 'kb' })];
      artifactRepo.createQueryBuilder.mockReturnValue(makeQb(mockRows));

      const user = makeUser();
      const results = await service.list(user, { templateKey: 'kb' });

      // The QB should have been called; getMany should return the row.
      expect(results).toHaveLength(1);
      expect(results[0].templateKey).toBe('kb');

      // Verify andWhere was invoked with a clause covering BOTH columns.
      const qb = (artifactRepo.createQueryBuilder as jest.Mock).mock.results[0].value;
      const andWhereCalls: string[] = qb.andWhere.mock.calls.map((c: [string]) => c[0]);
      const dualReadClause = andWhereCalls.find((c) => c.includes('template_key') && c.includes('type'));
      expect(dualReadClause).toBeDefined();
    });

    it('filtering by type=report (legacy param) hits both columns', async () => {
      const mockRows = [makeArtifact({ type: 'report', templateKey: 'report' })];
      artifactRepo.createQueryBuilder.mockReturnValue(makeQb(mockRows));

      const user = makeUser();
      const results = await service.list(user, { type: 'report' });
      expect(results).toHaveLength(1);

      const qb = (artifactRepo.createQueryBuilder as jest.Mock).mock.results[0].value;
      const andWhereCalls: string[] = qb.andWhere.mock.calls.map((c: [string]) => c[0]);
      const dualReadClause = andWhereCalls.find((c) => c.includes('template_key') && c.includes('type'));
      expect(dualReadClause).toBeDefined();
    });

    it('no type/templateKey filter → no dual-read andWhere on type columns', async () => {
      artifactRepo.createQueryBuilder.mockReturnValue(makeQb([]));

      const user = makeUser();
      await service.list(user, {});

      const qb = (artifactRepo.createQueryBuilder as jest.Mock).mock.results[0].value;
      const andWhereCalls: string[] = qb.andWhere.mock.calls.map((c: [string]) => c[0]);
      const typeClause = andWhereCalls.find(
        (c) => c.includes('template_key') || (c.includes('type') && c.includes('a.type')),
      );
      // No type filter applied — no andWhere with type column.
      expect(typeClause).toBeUndefined();
    });
  });
});
