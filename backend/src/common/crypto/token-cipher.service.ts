import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

// AES-256-GCM token encryption for deploy tokens stored in DB.
// Key source: ONEMCP_ENCRYPTION_KEY env (base64-encoded 32-byte key).
// Ciphertext format (stored as varchar/text): base64(iv):base64(ciphertext):base64(authTag)
// Boot guard: production env refuses start if key is absent or wrong length.

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV recommended for GCM
const TAG_BYTES = 16;  // 128-bit auth tag

@Injectable()
export class TokenCipherService implements OnModuleInit {
  private readonly logger = new Logger(TokenCipherService.name);
  private key!: Buffer;

  onModuleInit(): void {
    const raw = process.env.ONEMCP_ENCRYPTION_KEY;

    if (!raw) {
      if (process.env.NODE_ENV === 'production') {
        // Hard fail: encrypted deploy tokens cannot be read/written without key.
        throw new Error(
          '[TokenCipherService] ONEMCP_ENCRYPTION_KEY is required in production. ' +
          'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
        );
      }
      // Dev/test: use deterministic zero-key with warning. NOT safe for real data.
      this.logger.warn(
        'ONEMCP_ENCRYPTION_KEY not set — using insecure zero-key for development. ' +
        'Deploy tokens will NOT be portable across restarts with a real key.',
      );
      this.key = Buffer.alloc(32, 0);
      return;
    }

    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length !== 32) {
      throw new Error(
        `[TokenCipherService] ONEMCP_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${decoded.length}). ` +
        'Re-generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
      );
    }

    this.key = decoded;
    this.logger.log('TokenCipherService initialized with provided encryption key.');
  }

  // Encrypts plaintext string. Returns "iv:ciphertext:tag" (all base64 segments).
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      encrypted.toString('base64'),
      tag.toString('base64'),
    ].join(':');
  }

  // Decrypts payload produced by encrypt(). Throws on tampered/invalid ciphertext.
  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('[TokenCipherService] Invalid ciphertext format — expected iv:ciphertext:tag');
    }

    const [ivB64, ctB64, tagB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const ciphertext = Buffer.from(ctB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');

    if (iv.length !== IV_BYTES) {
      throw new Error(`[TokenCipherService] IV length mismatch: expected ${IV_BYTES}, got ${iv.length}`);
    }
    if (tag.length !== TAG_BYTES) {
      throw new Error(`[TokenCipherService] Auth tag length mismatch: expected ${TAG_BYTES}, got ${tag.length}`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
