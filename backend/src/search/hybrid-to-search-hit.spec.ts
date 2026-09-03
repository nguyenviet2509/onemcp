/**
 * Unit tests for hybridToSearchHit adapter.
 * Contract: HybridSearchHit → legacy SearchHit shape for portal HTTP callers.
 */
import { HybridSearchHit } from './search.service';
import { hybridToSearchHit, hybridToSearchHits } from './hybrid-to-search-hit';

function buildHybrid(overrides: Partial<HybridSearchHit> = {}): HybridSearchHit {
  return {
    artifactId: '42',
    versionId: '100',
    title: 'How to fix 502',
    slug: 'how-to-fix-502',
    templateKey: 'runbook',
    spaceId: 'space-abc',
    tags: ['nginx', '502'],
    snippet: '502 Bad Gateway <mark>timeout</mark>',
    source: 'hybrid',
    ftsRank: 0.12,
    vectorRank: 3,
    rrfScore: 0.028,
    updatedAt: '2026-08-15T10:00:00.000Z',
    versionNo: 4,
    ...overrides,
  };
}

describe('hybridToSearchHit', () => {
  it('maps core identity fields into SearchHit shape', () => {
    const out = hybridToSearchHit(buildHybrid());
    expect(out.kind).toBe('artifact');
    expect(out.id).toBe('42');
    expect(out.name).toBe('How to fix 502');
    expect(out.slug).toBe('how-to-fix-502');
    expect(out.snippet).toBe('502 Bad Gateway <mark>timeout</mark>');
    expect(out.tags).toEqual(['nginx', '502']);
  });

  it('uses rrfScore as rank (frontend orders by rank)', () => {
    const out = hybridToSearchHit(buildHybrid({ rrfScore: 0.5 }));
    expect(out.rank).toBe(0.5);
  });

  it('packs source + score details into meta', () => {
    const out = hybridToSearchHit(buildHybrid());
    expect(out.meta.source).toBe('hybrid');
    expect(out.meta.rrfScore).toBe(0.028);
    expect(out.meta.ftsRank).toBe(0.12);
    expect(out.meta.vectorRank).toBe(3);
  });

  it('carries versionId, spaceId, templateKey into meta', () => {
    const out = hybridToSearchHit(buildHybrid());
    expect(out.meta.versionId).toBe('100');
    expect(out.meta.spaceId).toBe('space-abc');
    expect(out.meta.templateKey).toBe('runbook');
  });

  it('carries updatedAt + versionNo (fill portal cosmetic fields)', () => {
    const out = hybridToSearchHit(buildHybrid());
    expect(out.meta.updatedAt).toBe('2026-08-15T10:00:00.000Z');
    expect(out.meta.versionNo).toBe(4);
  });

  it('handles missing optional fields (updatedAt, versionNo, ftsRank)', () => {
    const out = hybridToSearchHit(
      buildHybrid({ updatedAt: undefined, versionNo: undefined, ftsRank: undefined }),
    );
    expect(out.meta.updatedAt).toBeUndefined();
    expect(out.meta.versionNo).toBeUndefined();
    expect(out.meta.ftsRank).toBeUndefined();
    expect(out.id).toBe('42'); // core mapping still works
  });

  it('never emits SearchHit.id as undefined (regression guard for /artifacts/undefined bug)', () => {
    const out = hybridToSearchHit(buildHybrid({ artifactId: 'uuid-xyz' }));
    expect(out.id).toBeDefined();
    expect(out.id).not.toBe('undefined');
    expect(out.id).toBe('uuid-xyz');
  });
});

describe('hybridToSearchHits', () => {
  it('maps array preserving order', () => {
    const hits = [
      buildHybrid({ artifactId: 'a', title: 'A' }),
      buildHybrid({ artifactId: 'b', title: 'B' }),
    ];
    const out = hybridToSearchHits(hits);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('a');
    expect(out[0].name).toBe('A');
    expect(out[1].id).toBe('b');
    expect(out[1].name).toBe('B');
  });

  it('returns [] for empty input', () => {
    expect(hybridToSearchHits([])).toEqual([]);
  });
});
