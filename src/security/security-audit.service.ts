import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { createHash, createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type AuditSeverity = 'INFO' | 'WARN' | 'HIGH' | 'CRITICAL';

export interface SecurityAuditEntryInput {
  actorId?: string | null;
  eventType: string;
  severity?: AuditSeverity;
  target?: string;
  ip?: string;
  details?: Record<string, unknown>;
}

interface SecurityAuditDelegate {
  create?: (args: {
    data: {
      actorId: string | null;
      eventType: string;
      severity: string;
      target: string | null;
      ipHash: string | null;
      details?: Prisma.InputJsonValue;
      prevHash: string;
      entryHash: string;
    };
  }) => Promise<unknown>;
  findFirst?: (args: {
    orderBy: { createdAt: 'desc' };
    select: { entryHash: true };
  }) => Promise<{ entryHash: string } | null>;
}

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);
  private lastEntryHash = 'GENESIS_VIDALOCA_AUDIT_V1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  hashIdentifier(raw?: string | null): string | null {
    if (!raw) return null;
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const configuredPepper =
      this.configService.get<string>('AUDIT_HASH_PEPPER') ||
      this.configService.get<string>('JWT_SECRET');
    if (isProd && (!configuredPepper || configuredPepper.trim().length < 16)) {
      throw new Error(
        'AUDIT_HASH_PEPPER (>= 16 chars) is mandatory in production',
      );
    }
    const pepper = configuredPepper || 'vidaloca-dev-audit-pepper';
    return createHmac('sha256', pepper).update(raw).digest('hex');
  }

  async logEvent(input: SecurityAuditEntryInput): Promise<void> {
    try {
      const repo = (
        this.prisma as unknown as {
          securityAuditLog?: SecurityAuditDelegate;
        }
      )?.securityAuditLog;
      if (!repo?.create) {
        return;
      }

      const latest = repo.findFirst
        ? await repo
            .findFirst({
              orderBy: { createdAt: 'desc' },
              select: { entryHash: true },
            })
            .catch(() => null)
        : null;

      const prevHash = latest?.entryHash || this.lastEntryHash;
      const timestamp = new Date().toISOString();
      const ipHash = this.hashIdentifier(input.ip);
      const severity = input.severity ?? 'INFO';

      const canonical = JSON.stringify({
        prevHash,
        actorId: input.actorId ?? null,
        eventType: input.eventType,
        severity,
        target: input.target ?? null,
        ipHash,
        details: input.details ?? null,
        timestamp,
      });

      const entryHash = createHash('sha256').update(canonical).digest('hex');
      this.lastEntryHash = entryHash;

      await repo.create({
        data: {
          actorId: input.actorId ?? null,
          eventType: input.eventType,
          severity,
          target: input.target ?? null,
          ipHash,
          details: input.details as Prisma.InputJsonValue | undefined,
          prevHash,
          entryHash,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to persist security audit log: ${msg}`);
    }
  }
}
