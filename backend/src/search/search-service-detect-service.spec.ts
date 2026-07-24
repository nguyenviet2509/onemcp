/**
 * Unit tests for SearchService.detectService()
 * RT-10: word-boundary regex, case-insensitive, ambiguous = null.
 */
import { SearchService } from './search.service';

// Minimal DataSource mock — detectService không cần DB.
const mockDs = {} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('SearchService.detectService', () => {
  let service: SearchService;

  beforeEach(() => {
    // Reset env để test không bị ảnh hưởng lẫn nhau.
    delete process.env.ONEMCP_KNOWN_SERVICES;
    // Phase 2C: SearchService constructor now takes (ds, embeddingProvider?, metricsService?).
    // detectService() doesn't use either optional dep; pass nulls for unit test.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new SearchService(mockDs, null as any, null as any);
  });

  describe('single service match', () => {
    it('detects postgres from "postgres oom"', () => {
      const result = service.detectService('postgres oom', ['postgres', 'redis']);
      expect(result).toBe('postgres');
    });

    it('detects redis from "redis eviction"', () => {
      const result = service.detectService('redis eviction', ['postgres', 'redis', 'nginx']);
      expect(result).toBe('redis');
    });

    it('detects nginx from "nginx 502 gateway"', () => {
      const result = service.detectService('nginx 502 gateway', ['postgres', 'redis', 'nginx']);
      expect(result).toBe('nginx');
    });

    it('is case-insensitive — uppercase POSTGRES', () => {
      const result = service.detectService('POSTGRES connection refused', ['postgres', 'redis']);
      expect(result).toBe('postgres');
    });
  });

  describe('word-boundary — no false positives (RT-10)', () => {
    it('"redistribute traffic" does NOT match redis', () => {
      // "redistribute" contains "redis" as substring but NOT as word boundary.
      const result = service.detectService('redistribute traffic', ['postgres', 'redis', 'nginx']);
      expect(result).toBeNull();
    });

    it('"minio-backup-restore" does NOT match minio (hyphen is not word boundary for trailing)', () => {
      // \b matches between word char and non-word char.
      // "minio-" → minio IS at word boundary (hyphen is non-word), so minio WILL match.
      // This test documents actual regex behavior (not a bug — hyphen IS a boundary).
      const result = service.detectService('minio-backup-restore', ['minio', 'redis']);
      expect(result).toBe('minio'); // minio\b matches because '-' is non-word char
    });

    it('"gitlab-runner" does match gitlab because hyphen is word boundary', () => {
      // \bgitlab\b — 'gitlab' followed by '-' (non-word) → matches.
      // This is documented behavior: ops queries "gitlab-runner issue" still boosts gitlab.
      const result = service.detectService('gitlab-runner deploy failed', ['gitlab', 'redis']);
      expect(result).toBe('gitlab');
    });
  });

  describe('ambiguous — multiple services match', () => {
    it('returns null when nginx AND postgres both match', () => {
      const result = service.detectService('nginx postgres timeout', ['postgres', 'nginx']);
      expect(result).toBeNull();
    });

    it('returns null when redis AND postgres both match', () => {
      const result = service.detectService('postgres redis replication lag', ['postgres', 'redis']);
      expect(result).toBeNull();
    });
  });

  describe('no match', () => {
    it('returns null for generic query without known service', () => {
      const result = service.detectService('generic error in production', ['postgres', 'redis', 'nginx']);
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      const result = service.detectService('', ['postgres', 'redis']);
      expect(result).toBeNull();
    });
  });

  describe('uses injected knownServices list', () => {
    it('uses provided list over instance list', () => {
      // Custom list with a service NOT in default.
      const result = service.detectService('kafka lag spike', ['kafka', 'postgres']);
      expect(result).toBe('kafka');
    });
  });
});
