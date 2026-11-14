import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { VaultCryptoService } from './vault-crypto.service';
import { AntiPromptInjectionService } from './anti-prompt-injection.service';
import { SecurityAuditService } from './security-audit.service';
import { StoreSensitiveRecordDto, TokenizeCardDto } from './dto/security.dto';

export interface MaskedVaultItem {
  vaultToken: string;
  recordType: string;
  maskedSummary: string;
  cardBrand: string | null;
  cardLast4: string | null;
  expMonth: number | null;
  expYear: number | null;
  keyVersion: number;
  createdAt: Date;
}

@Injectable()
export class VaultService {
  private lastVaultLogHash = 'GENESIS_VIDALOCA_VAULT_V1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: VaultCryptoService,
    private readonly promptShield: AntiPromptInjectionService,
    private readonly auditService: SecurityAuditService,
  ) {}

  async tokenizeCard(
    userId: string,
    dto: TokenizeCardDto,
    ip?: string,
  ): Promise<MaskedVaultItem> {
    const safeHolder = this.promptShield.assertSafeInput(
      dto.cardholderName,
      'cardholderName',
      80,
    );
    const safePostal = dto.billingPostalCode
      ? this.promptShield.assertSafeInput(dto.billingPostalCode, 'postal', 16)
      : undefined;

    const validated = this.crypto.validateAndMaskCard(
      dto.cardNumber,
      dto.expMonth,
      dto.expYear,
    );
    const ownerHash = this.crypto.computeOwnerHash(userId);

    // Check if this exact card is already tokenized and active for this user
    const existing = await this.prisma.vaultRecord.findFirst({
      where: {
        ownerUserIdHash: ownerHash,
        blindIndex: validated.blindIndex,
        recordType: 'PAYMENT_CARD',
        isRevoked: false,
      },
    });
    if (existing) {
      throw new BadRequestException('Esta tarjeta ya está tokenizada en tu bóveda');
    }

    // Store tokenized card metadata inside isolated AES-256-GCM envelope.
    // Note: Only last4 + brand + tokenized fingerprint are stored inside the encrypted envelope;
    // raw PAN is discarded immediately after validation and blind-indexing.
    const vaultToken = `vl_card_${randomBytes(18).toString('base64url')}`;
    const envelope = this.crypto.encryptJson({
      cardholderName: safeHolder,
      cardBrand: validated.brand,
      cardLast4: validated.last4,
      expMonth: dto.expMonth,
      expYear: dto.expYear,
      billingPostalCode: safePostal ?? null,
      tokenizedAt: new Date().toISOString(),
    });

    const record = await this.prisma.vaultRecord.create({
      data: {
        vaultToken,
        ownerUserIdHash: ownerHash,
        recordType: 'PAYMENT_CARD',
        keyVersion: envelope.keyVersion,
        algorithm: envelope.algorithm,
        encryptedDek: envelope.encryptedDek,
        iv: envelope.iv,
        authTag: envelope.authTag,
        encryptedPayload: envelope.encryptedPayload,
        blindIndex: validated.blindIndex,
        maskedSummary: validated.maskedSummary,
        cardBrand: validated.brand,
        cardLast4: validated.last4,
        expMonth: dto.expMonth,
        expYear: dto.expYear,
      },
    });

    await this.logVaultAccess({
      vaultRecordId: record.id,
      actorIdHash: ownerHash,
      action: 'TOKENIZE_CARD',
      outcome: 'ALLOWED',
      ip,
      reason: `Tokenized ${validated.maskedSummary}`,
    });

    await this.auditService.logEvent({
      actorId: userId,
      eventType: 'VAULT_CARD_TOKENIZED',
      severity: 'INFO',
      target: record.vaultToken,
      ip,
      details: { cardBrand: validated.brand, last4: validated.last4 },
    });

    return this.toMaskedView(record);
  }

  async storeSensitiveRecord(
    userId: string,
    dto: StoreSensitiveRecordDto,
    ip?: string,
  ): Promise<MaskedVaultItem> {
    const safeLabel = this.promptShield.assertSafeInput(dto.label, 'label', 80);
    const safeValue = this.promptShield.sanitizeText(dto.secretValue, 512);
    if (safeValue.length < 4) {
      throw new BadRequestException('Valor sensible demasiado corto');
    }

    const ownerHash = this.crypto.computeOwnerHash(userId);
    const blindIndex = this.crypto.computeBlindIndex(
      `${ownerHash}:${dto.recordType}:${safeValue}`,
      dto.recordType,
    );
    const vaultToken = `vl_sec_${randomBytes(18).toString('base64url')}`;

    const tail = safeValue.slice(-2);
    const maskedSummary = `${safeLabel} (•••${tail})`;

    const envelope = this.crypto.encryptJson({
      label: safeLabel,
      secretValue: safeValue,
      storedAt: new Date().toISOString(),
    });

    const record = await this.prisma.vaultRecord.create({
      data: {
        vaultToken,
        ownerUserIdHash: ownerHash,
        recordType: dto.recordType,
        keyVersion: envelope.keyVersion,
        algorithm: envelope.algorithm,
        encryptedDek: envelope.encryptedDek,
        iv: envelope.iv,
        authTag: envelope.authTag,
        encryptedPayload: envelope.encryptedPayload,
        blindIndex,
        maskedSummary,
      },
    });

    await this.logVaultAccess({
      vaultRecordId: record.id,
      actorIdHash: ownerHash,
      action: `STORE_${dto.recordType}`,
      outcome: 'ALLOWED',
      ip,
      reason: `Stored encrypted ${dto.recordType}`,
    });

    return this.toMaskedView(record);
  }

  async listMaskedRecords(
    userId: string,
    ip?: string,
  ): Promise<MaskedVaultItem[]> {
    const ownerHash = this.crypto.computeOwnerHash(userId);
    const records = await this.prisma.vaultRecord.findMany({
      where: {
        ownerUserIdHash: ownerHash,
        isRevoked: false,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        vaultToken: true,
        recordType: true,
        maskedSummary: true,
        cardBrand: true,
        cardLast4: true,
        expMonth: true,
        expYear: true,
        keyVersion: true,
        createdAt: true,
      },
    });

    await this.logVaultAccess({
      actorIdHash: ownerHash,
      action: 'LIST_MASKED',
      outcome: 'ALLOWED',
      ip,
      reason: `Listed ${records.length} masked records`,
    });

    return records;
  }

  async revokeRecord(
    userId: string,
    vaultToken: string,
    ip?: string,
  ): Promise<{ revoked: true; vaultToken: string }> {
    const ownerHash = this.crypto.computeOwnerHash(userId);
    const record = await this.prisma.vaultRecord.findUnique({
      where: { vaultToken },
    });

    if (!record || record.ownerUserIdHash !== ownerHash) {
      await this.logVaultAccess({
        actorIdHash: ownerHash,
        action: 'REVOKE',
        outcome: 'BLOCKED',
        ip,
        reason: 'Record not found or owner mismatch',
      });
      throw new NotFoundException('Registro de bóveda no encontrado');
    }

    await this.prisma.vaultRecord.update({
      where: { id: record.id },
      data: {
        isRevoked: true,
        encryptedPayload: 'REVOKED',
        encryptedDek: 'REVOKED',
      },
    });

    await this.logVaultAccess({
      vaultRecordId: record.id,
      actorIdHash: ownerHash,
      action: 'REVOKE',
      outcome: 'ALLOWED',
      ip,
      reason: 'Owner revoked and shredded ciphertext',
    });

    return { revoked: true, vaultToken };
  }

  private toMaskedView(record: {
    vaultToken: string;
    recordType: string;
    maskedSummary: string;
    cardBrand: string | null;
    cardLast4: string | null;
    expMonth: number | null;
    expYear: number | null;
    keyVersion: number;
    createdAt: Date;
  }): MaskedVaultItem {
    return {
      vaultToken: record.vaultToken,
      recordType: record.recordType,
      maskedSummary: record.maskedSummary,
      cardBrand: record.cardBrand,
      cardLast4: record.cardLast4,
      expMonth: record.expMonth,
      expYear: record.expYear,
      keyVersion: record.keyVersion,
      createdAt: record.createdAt,
    };
  }

  private async logVaultAccess(input: {
    vaultRecordId?: string;
    actorIdHash: string;
    action: string;
    outcome: 'ALLOWED' | 'BLOCKED';
    ip?: string;
    reason?: string;
  }): Promise<void> {
    try {
      const latest = await this.prisma.vaultAccessLog
        .findFirst({
          orderBy: { createdAt: 'desc' },
          select: { entryHash: true },
        })
        .catch(() => null);
      const prevHash = latest?.entryHash || this.lastVaultLogHash;
      const ipHash = this.auditService.hashIdentifier(input.ip);
      const canonical = JSON.stringify({
        prevHash,
        vaultRecordId: input.vaultRecordId ?? null,
        actorIdHash: input.actorIdHash,
        action: input.action,
        outcome: input.outcome,
        ipHash,
        reason: input.reason ?? null,
        ts: new Date().toISOString(),
      });
      const entryHash = createHash('sha256').update(canonical).digest('hex');
      this.lastVaultLogHash = entryHash;

      await this.prisma.vaultAccessLog.create({
        data: {
          vaultRecordId: input.vaultRecordId ?? null,
          actorIdHash: input.actorIdHash,
          action: input.action,
          outcome: input.outcome,
          ipHash,
          reason: input.reason ?? null,
          prevHash,
          entryHash,
        },
      });
    } catch {
      // Never leak vault errors in logs
    }
  }
}
