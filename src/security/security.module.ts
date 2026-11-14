import { Global, Module } from '@nestjs/common';
import { AntiPromptInjectionService } from './anti-prompt-injection.service';
import { SecurityAuditService } from './security-audit.service';
import { AntiCheatService } from './anti-cheat.service';
import { VaultCryptoService } from './vault-crypto.service';
import { VaultService } from './vault.service';
import { SecurityController, VaultController } from './vault.controller';
import { PromptInjectionInterceptor } from './prompt-injection.interceptor';

@Global()
@Module({
  controllers: [VaultController, SecurityController],
  providers: [
    AntiPromptInjectionService,
    SecurityAuditService,
    AntiCheatService,
    VaultCryptoService,
    VaultService,
    PromptInjectionInterceptor,
  ],
  exports: [
    AntiPromptInjectionService,
    SecurityAuditService,
    AntiCheatService,
    VaultCryptoService,
    VaultService,
    PromptInjectionInterceptor,
  ],
})
export class SecurityModule {}
