/**
 * Unit tests for ApiKeysService — create + verify roundtrip.
 * Tests run without real DB: Repository and UsersService are mocked.
 * Coverage: create, verify (happy), wrong key (null), revoked key (null), expired key (null).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from './api-key.entity';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

// ---- helpers ----

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: '1',
    userId: '42',
    keyHash: '',       // filled per test
    keyPrefix: 'omk_abcd1234',
    label: null,
    lastUsedAt: null,
    expiresAt: new Date(Date.now() + 90 * 86_400_000),
    revoked: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let mockRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let mockUsers: { findById: jest.Mock };

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (entity) => ({ ...entity, id: '1' })),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      update: jest.fn(async () => undefined),
    };

    mockUsers = {
      findById: jest.fn(async () => ({ id: 42, username: 'alice', status: 'active' })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: getRepositoryToken(ApiKey), useValue: mockRepo },
        { provide: UsersService, useValue: mockUsers },
      ],
    }).compile();

    service = module.get(ApiKeysService);
  });

  describe('create', () => {
    it('returns full key (starts with omk_) and saves bcrypt hash', async () => {
      const result = await service.create('42', 'CI key');

      expect(result.key).toMatch(/^omk_[0-9a-f]{8}/);
      expect(result.prefix).toBe(result.key.slice(0, 12)); // "omk_" + 8 hex = 12 chars
      expect(result.id).toBe('1');
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify the hash stored in repo matches the raw key.
      const savedHash = mockRepo.save.mock.calls[0][0].keyHash;
      expect(await bcrypt.compare(result.key, savedHash)).toBe(true);
    });

    it('caps expiresInDays at MAX_EXPIRE_DAYS (365)', async () => {
      const result = await service.create('42', null, 999);
      const diffDays = Math.round((result.expiresAt.getTime() - Date.now()) / 86_400_000);
      expect(diffDays).toBeLessThanOrEqual(365);
      expect(diffDays).toBeGreaterThanOrEqual(364); // allow 1-day float
    });
  });

  describe('verify', () => {
    let rawKey: string;
    let hash: string;

    beforeEach(async () => {
      // Create a real key + hash pair for verify tests.
      const created = await service.create('42', null);
      rawKey = created.key;
      hash = mockRepo.save.mock.calls[0][0].keyHash;
      // Reset call count for subsequent tests.
      mockRepo.save.mockClear();
    });

    it('happy path — returns user info on valid key', async () => {
      mockRepo.findOne.mockResolvedValueOnce(makeKey({ keyHash: hash }));
      const user = await service.verify(rawKey);
      expect(user).toMatchObject({ username: 'alice', id: 42 });
    });

    it('returns null for completely wrong key', async () => {
      mockRepo.findOne.mockResolvedValueOnce(makeKey({ keyHash: hash }));
      // Wrong key — same prefix structure but different suffix.
      const badKey = rawKey.slice(0, 12) + 'x'.repeat(rawKey.length - 12);
      const user = await service.verify(badKey);
      expect(user).toBeNull();
    });

    it('returns null for revoked key', async () => {
      mockRepo.findOne.mockResolvedValueOnce(makeKey({ keyHash: hash, revoked: true }));
      const user = await service.verify(rawKey);
      expect(user).toBeNull();
    });

    it('returns null for expired key', async () => {
      const past = new Date(Date.now() - 1000);
      mockRepo.findOne.mockResolvedValueOnce(makeKey({ keyHash: hash, expiresAt: past }));
      const user = await service.verify(rawKey);
      expect(user).toBeNull();
    });

    it('returns null if key prefix not found in DB', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      const user = await service.verify(rawKey);
      expect(user).toBeNull();
    });

    it('returns null for string that does not start with omk_', async () => {
      const user = await service.verify('Bearer invalid');
      expect(user).toBeNull();
    });
  });
});
