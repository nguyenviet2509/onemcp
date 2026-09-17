/**
 * Unit tests for ToolUpstreamsService — encrypt/decrypt roundtrip + CRUD masking.
 * No real DB: Repository mocked. TokenCipherService uses real crypto (zero-key dev mode).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ToolUpstreamsService } from './tool-upstreams.service';
import { ToolUpstream } from './entities/tool-upstream.entity';
import { TokenCipherService } from '../common/crypto/token-cipher.service';

function makeUpstream(overrides: Partial<ToolUpstream> = {}): ToolUpstream {
  return {
    id: 'uuid-1',
    name: 'osh-admin',
    baseUrl: 'https://osh.example.com',
    bearerCiphertext: '',
    timeoutMs: 10000,
    enabled: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('ToolUpstreamsService', () => {
  let service: ToolUpstreamsService;
  let cipher: TokenCipherService;
  let mockRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn((data) => ({ ...makeUpstream(), ...data })),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolUpstreamsService,
        TokenCipherService,
        { provide: getRepositoryToken(ToolUpstream), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(ToolUpstreamsService);
    cipher = module.get(TokenCipherService);
    // Init zero-key for tests (dev mode)
    cipher.onModuleInit();
  });

  it('create: encrypts bearer, response masks as "***"', async () => {
    const result = await service.create({
      name: 'osh-admin',
      baseUrl: 'https://osh.example.com',
      bearer: 'super-secret-token',
      timeoutMs: 10000,
      enabled: true,
    });

    expect(result.bearer).toBe('***');
    // Verify ciphertext was stored (not plaintext)
    const saved = mockRepo.save.mock.calls[0][0] as ToolUpstream;
    expect(saved.bearerCiphertext).not.toBe('super-secret-token');
    expect(saved.bearerCiphertext).toMatch(/^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/);
  });

  it('create: ciphertext decrypts back to original bearer', async () => {
    await service.create({
      name: 'osh-admin',
      baseUrl: 'https://osh.example.com',
      bearer: 'my-secret',
      timeoutMs: 5000,
      enabled: true,
    });

    const saved = mockRepo.save.mock.calls[0][0] as ToolUpstream;
    const decrypted = cipher.decrypt(saved.bearerCiphertext);
    expect(decrypted).toBe('my-secret');
  });

  it('get: response masks bearer as "***"', async () => {
    const ciphertext = cipher.encrypt('plaintext-bearer');
    mockRepo.findOne.mockResolvedValue(makeUpstream({ bearerCiphertext: ciphertext }));

    const result = await service.get('uuid-1');
    expect(result.bearer).toBe('***');
  });

  it('get: throws NotFoundException for unknown id', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.get('non-existent')).rejects.toThrow(NotFoundException);
  });

  it('update: re-encrypts bearer when provided', async () => {
    const original = cipher.encrypt('old-bearer');
    mockRepo.findOne.mockResolvedValue(makeUpstream({ bearerCiphertext: original }));

    await service.update('uuid-1', { bearer: 'new-bearer' });

    const saved = mockRepo.save.mock.calls[0][0] as ToolUpstream;
    expect(cipher.decrypt(saved.bearerCiphertext)).toBe('new-bearer');
  });

  it('update: preserves ciphertext when bearer not in dto', async () => {
    const original = cipher.encrypt('unchanged');
    mockRepo.findOne.mockResolvedValue(makeUpstream({ bearerCiphertext: original }));

    await service.update('uuid-1', { name: 'new-name' });

    const saved = mockRepo.save.mock.calls[0][0] as ToolUpstream;
    expect(cipher.decrypt(saved.bearerCiphertext)).toBe('unchanged');
  });

  it('getDecryptedBearer: returns plaintext', async () => {
    const ct = cipher.encrypt('plaintext');
    mockRepo.findOne.mockResolvedValue(makeUpstream({ bearerCiphertext: ct }));

    const result = await service.getDecryptedBearer('uuid-1');
    expect(result).toBe('plaintext');
  });

  it('disable: sets enabled=false', async () => {
    mockRepo.findOne.mockResolvedValue(makeUpstream({ enabled: true }));
    await service.disable('uuid-1');
    const saved = mockRepo.save.mock.calls[0][0] as ToolUpstream;
    expect(saved.enabled).toBe(false);
  });
});
