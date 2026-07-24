import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ApiKey } from './api-key.entity';
import { UsersService } from '../users/users.service';

// Verified-hash cache entry: maps key_prefix → { userId, cachedUntil }.
// Avoids bcrypt on every hot-path request. TTL = 60 s.
interface CacheEntry {
  userId: string;
  cachedUntil: number; // Date.now() ms
}

// Sliding-window rate limit: tracks request timestamps per key prefix.
// Default: 60 req / 60 s window.
const RATE_LIMIT_MAX = 60;
const RATE_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 60_000;
const BCRYPT_COST = 10;
const KEY_PREFIX_STR = 'omk_';
const DEFAULT_EXPIRE_DAYS = 90;
const MAX_EXPIRE_DAYS = 365;

@Injectable()
export class ApiKeysService {
  private readonly log = new Logger(ApiKeysService.name);

  // In-memory structures — reset on restart (acceptable: cache is perf optimisation only).
  private readonly verifyCache = new Map<string, CacheEntry>();
  private readonly rateWindows = new Map<string, number[]>(); // prefix → timestamp[]

  constructor(
    @InjectRepository(ApiKey) private readonly repo: Repository<ApiKey>,
    private readonly users: UsersService,
  ) {}

  // Create a new API key for userId. Returns the full raw key ONCE.
  async create(
    userId: string,
    label: string | null,
    expiresInDays: number = DEFAULT_EXPIRE_DAYS,
  ): Promise<{ id: string; prefix: string; key: string; expiresAt: Date }> {
    const days = Math.min(Math.max(expiresInDays, 1), MAX_EXPIRE_DAYS);

    const rawBytes = crypto.randomBytes(32);
    const rawHex = rawBytes.toString('hex');
    const prefix = KEY_PREFIX_STR + rawHex.slice(0, 8); // "omk_" + 8 hex chars = 12 chars
    const rawKey = prefix + rawHex.slice(8);             // full key for user to copy

    const keyHash = await bcrypt.hash(rawKey, BCRYPT_COST);

    const expiresAt = new Date(Date.now() + days * 86_400_000);

    const row = this.repo.create({ userId, keyHash, keyPrefix: prefix, label, expiresAt });
    const saved = await this.repo.save(row);

    this.log.log(`api_key_created userId=${userId} prefix=${prefix}`);
    return { id: saved.id, prefix, key: rawKey, expiresAt };
  }

  // List keys for a user — never returns hash or full key.
  list(userId: string): Promise<Pick<ApiKey, 'id' | 'keyPrefix' | 'label' | 'expiresAt' | 'lastUsedAt' | 'revoked' | 'createdAt'>[]> {
    return this.repo.find({
      where: { userId },
      select: ['id', 'keyPrefix', 'label', 'expiresAt', 'lastUsedAt', 'revoked', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  // Revoke a key — only the owning user can revoke.
  async revoke(userId: string, id: string): Promise<void> {
    const key = await this.repo.findOne({ where: { id } });
    if (!key) throw new NotFoundException(`API key ${id} không tìm thấy`);
    if (key.userId !== userId) throw new ForbiddenException('Không thể thu hồi key của người khác');
    key.revoked = true;
    await this.repo.save(key);
    // Evict from cache immediately so revocation takes effect without waiting for TTL.
    this.verifyCache.delete(key.keyPrefix);
    this.log.log(`api_key_revoked id=${id} prefix=${key.keyPrefix}`);
  }

  // Verify a raw key from X-Onemcp-Key header.
  // Returns { id, username, role } suitable for req.user population, or null if invalid.
  async verify(rawKey: string): Promise<{ id: number; username: string; role: string } | null> {
    // Extract prefix: first 12 chars ("omk_" + 8 hex).
    if (!rawKey.startsWith(KEY_PREFIX_STR) || rawKey.length < 12) return null;
    const prefix = rawKey.slice(0, 12);

    // Rate limit check — before bcrypt to prevent timing abuse.
    if (!this.checkRateLimit(prefix)) {
      this.log.warn(`api_key_rate_limit_exceeded prefix=${prefix}`);
      return null; // Middleware converts this to 429.
    }

    // Cache hit: skip bcrypt.
    const cached = this.verifyCache.get(prefix);
    if (cached && cached.cachedUntil > Date.now()) {
      const user = await this.users.findById(Number(cached.userId));
      if (!user || user.status === 'disabled') return null;
      // Fire-and-forget last_used_at update — don't block response.
      void this.touchLastUsed(prefix);
      return { id: user.id, username: user.username, role: 'contributor' };
    }

    // Cache miss: full DB + bcrypt path.
    const row = await this.repo.findOne({ where: { keyPrefix: prefix } });
    if (!row) return null;
    if (row.revoked) return null;
    if (row.expiresAt && row.expiresAt < new Date()) return null;

    const match = await bcrypt.compare(rawKey, row.keyHash);
    if (!match) return null;

    // Populate cache.
    this.verifyCache.set(prefix, { userId: row.userId, cachedUntil: Date.now() + CACHE_TTL_MS });

    const user = await this.users.findById(Number(row.userId));
    if (!user || user.status === 'disabled') return null;

    void this.touchLastUsed(prefix);
    return { id: user.id, username: user.username, role: 'contributor' };
  }

  // Returns false if rate limit exceeded for this prefix.
  private checkRateLimit(prefix: string): boolean {
    const now = Date.now();
    const cutoff = now - RATE_WINDOW_MS;
    let timestamps = this.rateWindows.get(prefix) ?? [];
    // Slide the window — drop timestamps older than cutoff.
    timestamps = timestamps.filter((t) => t > cutoff);
    if (timestamps.length >= RATE_LIMIT_MAX) {
      this.rateWindows.set(prefix, timestamps);
      return false;
    }
    timestamps.push(now);
    this.rateWindows.set(prefix, timestamps);
    return true;
  }

  // isRateLimited exposed for middleware to distinguish 401 vs 429.
  isRateLimited(prefix: string): boolean {
    const now = Date.now();
    const cutoff = now - RATE_WINDOW_MS;
    const timestamps = (this.rateWindows.get(prefix) ?? []).filter((t) => t > cutoff);
    return timestamps.length >= RATE_LIMIT_MAX;
  }

  private async touchLastUsed(prefix: string): Promise<void> {
    try {
      await this.repo.update({ keyPrefix: prefix }, { lastUsedAt: new Date() });
    } catch (err) {
      this.log.warn(`touch_last_used failed prefix=${prefix}: ${String(err)}`);
    }
  }
}
