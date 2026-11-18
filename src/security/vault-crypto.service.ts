import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'crypto';

export interface EnvelopeEncryptedData {
  keyVersion: number;
  algorithm: 'AES-256-GCM';
  encryptedDek: string;
  iv: string;
  authTag: string;
  encryptedPayload: string;
}

export interface CardValidationResult {
  brand: 'VISA' | 'MASTERCARD' | 'AMEX' | 'OTHER';
  last4: string;
  maskedSummary: string;
  blindIndex: string;
  normalizedPan: string;
}

@Injectable()
export class VaultCryptoService {
  private readonly logger = new Logger(VaultCryptoService.name);
  private readonly AAD_PAYLOAD = Buffer.from(
    'vidaloca-vault-payload-v1',
    'utf8',
  );
  private readonly AAD_DEK = Buffer.from('vidaloca-vault-dek-wrap-v1', 'utf8');
  readonly currentKeyVersion = 1;

  constructor(private readonly configService: ConfigService) {}

  private getRootSecret(): Buffer {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const configured = this.configService.get<string>('VAULT_MASTER_KEY');

    if (configured && configured.trim().length >= 32) {
      return Buffer.from(configured.trim(), 'utf8');
    }

    if (isProd) {
      throw new Error(
        'VAULT_MASTER_KEY (>= 32 chars) is mandatory in production',
      );
    }

    // Development/test fallback isolated from JWT_SECRET via dedicated HKDF salt/info
    const devSeed =
      configured ||
      this.configService.get<string>('JWT_SECRET') ||
      'vidaloca-dev-only-vault-master-seed-change-in-prod';
    if (!configured) {
      this.logger.warn(
        'Using ephemeral/dev VAULT_MASTER_KEY fallback. Set VAULT_MASTER_KEY in .env for production!',
      );
    }
    return Buffer.from(devSeed, 'utf8');
  }

  private deriveKey(purpose: string, keyVersion = 1): Buffer {
    const root = this.getRootSecret();
    const salt = Buffer.from(`vidaloca-vault-salt-v${keyVersion}`, 'utf8');
    const info = Buffer.from(purpose, 'utf8');
    return Buffer.from(hkdfSync('sha256', root, salt, info, 32));
  }

  computeOwnerHash(userId: string): string {
    const key = this.deriveKey('owner-id-hash');
    try {
      return createHmac('sha256', key).update(userId).digest('hex');
    } finally {
      key.fill(0);
    }
  }

  computeBlindIndex(value: string, scope: string): string {
    const key = this.deriveKey(`blind-index:${scope}`);
    try {
      return createHmac('sha256', key).update(value).digest('hex');
    } finally {
      key.fill(0);
    }
  }

  encryptJson(payload: Record<string, unknown>): EnvelopeEncryptedData {
    // Defense in depth: never allow CVV/CVC/PIN inside the vault payload
    const forbiddenKeys = ['cvv', 'cvc', 'cvv2', 'securityCode', 'pin'];
    for (const k of Object.keys(payload)) {
      if (forbiddenKeys.includes(k.toLowerCase())) {
        throw new BadRequestException(
          `PCI-DSS: el campo sensible '${k}' nunca puede almacenarse`,
        );
      }
    }

    const dek = randomBytes(32);
    const kek = this.deriveKey('master-kek', this.currentKeyVersion);

    try {
      // 1. Encrypt payload with fresh per-record DEK
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', dek, iv);
      cipher.setAAD(this.AAD_PAYLOAD);
      const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
      const encryptedBuf = Buffer.concat([
        cipher.update(plaintext),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();
      plaintext.fill(0);

      // 2. Wrap DEK with Master KEK
      const dekIv = randomBytes(12);
      const wrapCipher = createCipheriv('aes-256-gcm', kek, dekIv);
      wrapCipher.setAAD(this.AAD_DEK);
      const wrappedDek = Buffer.concat([
        wrapCipher.update(dek),
        wrapCipher.final(),
      ]);
      const dekTag = wrapCipher.getAuthTag();

      return {
        keyVersion: this.currentKeyVersion,
        algorithm: 'AES-256-GCM',
        encryptedDek: `${dekIv.toString('base64')}:${dekTag.toString('base64')}:${wrappedDek.toString('base64')}`,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        encryptedPayload: encryptedBuf.toString('base64'),
      };
    } finally {
      dek.fill(0);
      kek.fill(0);
    }
  }

  decryptJson(record: {
    keyVersion: number;
    encryptedDek: string;
    iv: string;
    authTag: string;
    encryptedPayload: string;
  }): Record<string, unknown> {
    const parts = record.encryptedDek.split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed encrypted DEK envelope');
    }

    const [dekIvB64, dekTagB64, wrappedDekB64] = parts;
    const kek = this.deriveKey('master-kek', record.keyVersion);
    let dek: Buffer | null = null;

    try {
      const unwrap = createDecipheriv(
        'aes-256-gcm',
        kek,
        Buffer.from(dekIvB64, 'base64'),
      );
      unwrap.setAAD(this.AAD_DEK);
      unwrap.setAuthTag(Buffer.from(dekTagB64, 'base64'));
      dek = Buffer.concat([
        unwrap.update(Buffer.from(wrappedDekB64, 'base64')),
        unwrap.final(),
      ]);

      const decipher = createDecipheriv(
        'aes-256-gcm',
        dek,
        Buffer.from(record.iv, 'base64'),
      );
      decipher.setAAD(this.AAD_PAYLOAD);
      decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
      const plainBuf = Buffer.concat([
        decipher.update(Buffer.from(record.encryptedPayload, 'base64')),
        decipher.final(),
      ]);

      const parsed = JSON.parse(plainBuf.toString('utf8')) as Record<
        string,
        unknown
      >;
      plainBuf.fill(0);
      return parsed;
    } finally {
      if (dek) dek.fill(0);
      kek.fill(0);
    }
  }

  validateAndMaskCard(
    rawCardNumber: string,
    expMonth: number,
    expYear: number,
  ): CardValidationResult {
    const normalizedPan = rawCardNumber.replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(normalizedPan)) {
      throw new BadRequestException('Número de tarjeta inválido');
    }

    if (!this.passesLuhn(normalizedPan)) {
      throw new BadRequestException(
        'Número de tarjeta no supera verificación Luhn',
      );
    }

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    if (
      expYear < currentYear ||
      (expYear === currentYear && expMonth < currentMonth)
    ) {
      throw new BadRequestException('La tarjeta está caducada');
    }

    let brand: CardValidationResult['brand'] = 'OTHER';
    if (/^4\d{12}(\d{3})?(\d{3})?$/.test(normalizedPan)) {
      brand = 'VISA';
    } else if (
      /^(5[1-5]\d{14}|2(2[2-9]\d{12}|[3-6]\d{13}|7[01]\d{12}|720\d{12}))$/.test(
        normalizedPan,
      )
    ) {
      brand = 'MASTERCARD';
    } else if (/^3[47]\d{13}$/.test(normalizedPan)) {
      brand = 'AMEX';
    }

    const last4 = normalizedPan.slice(-4);
    const mm = String(expMonth).padStart(2, '0');
    const yy = String(expYear).slice(-2);

    return {
      brand,
      last4,
      maskedSummary: `${brand} •••• ${last4} (${mm}/${yy})`,
      blindIndex: this.computeBlindIndex(normalizedPan, 'payment-card'),
      normalizedPan,
    };
  }

  private passesLuhn(digits: string): boolean {
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }
}
