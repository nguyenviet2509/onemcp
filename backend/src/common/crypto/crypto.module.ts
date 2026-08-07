import { Global, Module } from '@nestjs/common';
import { TokenCipherService } from './token-cipher.service';

// Global so ProjectsModule (and future modules needing encryption) can inject
// TokenCipherService without re-importing CryptoModule each time.
@Global()
@Module({
  providers: [TokenCipherService],
  exports: [TokenCipherService],
})
export class CryptoModule {}
