/**
 * Unit tests for SavedSearchesService ownership checks.
 * Concern: TypeORM maps PG bigint → JS string at runtime; user.id may arrive as
 * number or string from middleware. Both sides must compare equal regardless of type.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SavedSearchesService } from './saved-searches.service';
import { RequestUser } from '../common/user-request';

// Minimal repo mock — only methods used by delete() and run() are needed.
function makeRepo(saved: Record<string, unknown> | null) {
  return {
    findOne: jest.fn().mockResolvedValue(saved),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

// Minimal SearchService mock — run() delegates to hybrid().
const mockSearchService = {
  hybrid: jest.fn().mockResolvedValue([]),
};

function makeUser(id: number | string): RequestUser {
  return {
    id: id as number,
    username: 'testuser',
    departmentId: 1,
    roles: [],
  } as unknown as RequestUser;
}

function makeService(saved: Record<string, unknown> | null): SavedSearchesService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new SavedSearchesService(makeRepo(saved) as any, mockSearchService as any);
}

describe('SavedSearchesService — ownership check (bigint coercion)', () => {
  describe('delete()', () => {
    it('allows owner to delete when userId is stored as string (PG bigint runtime)', async () => {
      // PG bigint → TypeORM returns string '42' even though entity types it as number.
      const svc = makeService({ id: '1', userId: '42', name: 'test', query: 'q', filters: {}, mode: 'hybrid', createdAt: new Date() });
      await expect(svc.delete(makeUser(42), '1')).resolves.toBeUndefined();
    });

    it('allows owner to delete when both userId and user.id are numeric strings', async () => {
      const svc = makeService({ id: '1', userId: '999', name: 'test', query: 'q', filters: {}, mode: 'hybrid', createdAt: new Date() });
      await expect(svc.delete(makeUser('999'), '1')).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when different user attempts delete', async () => {
      const svc = makeService({ id: '1', userId: '42', name: 'test', query: 'q', filters: {}, mode: 'hybrid', createdAt: new Date() });
      await expect(svc.delete(makeUser(99), '1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when saved search does not exist', async () => {
      const svc = makeService(null);
      await expect(svc.delete(makeUser(42), '999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('run()', () => {
    it('allows owner to re-run when userId stored as string', async () => {
      const svc = makeService({ id: '5', userId: '7', name: 'test', query: 'q', filters: {}, mode: 'hybrid', createdAt: new Date() });
      await expect(svc.run(makeUser(7), '5')).resolves.toEqual([]);
    });

    it('throws ForbiddenException when non-owner tries to run', async () => {
      const svc = makeService({ id: '5', userId: '7', name: 'test', query: 'q', filters: {}, mode: 'hybrid', createdAt: new Date() });
      await expect(svc.run(makeUser(8), '5')).rejects.toThrow(ForbiddenException);
    });
  });
});
