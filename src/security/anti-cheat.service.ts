import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityAuditService } from './security-audit.service';

export type AntiCheatRule =
  | 'SPEEDHACK'
  | 'TELEPORT'
  | 'OUT_OF_BOUNDS'
  | 'RATE_ABUSE'
  | 'PROMPT_INJECT'
  | 'ECONOMY_TAMPER'
  | 'DOUBLE_CLAIM'
  | 'MISSION_SPEEDRUN';

@Injectable()
export class AntiCheatService {
  private readonly logger = new Logger(AntiCheatService.name);
  /** `${playerId}:${actionKey}` -> last timestamp (ms) */
  private readonly cooldowns = new Map<string, number>();
  /** `${playerId}` -> timestamps of recent strikes within 60s window */
  private readonly strikeWindow = new Map<string, number[]>();

  private readonly STRIKE_WINDOW_MS = 60_000;
  private readonly MAX_STRIKES_BEFORE_KICK = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: SecurityAuditService,
  ) {}

  assertFinitePositive(
    value: unknown,
    fieldName = 'amount',
    max = 1_000_000_000,
  ): number {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > max
    ) {
      throw new BadRequestException(
        `${fieldName} debe ser un número finito positivo (<= ${max})`,
      );
    }
    return value;
  }

  assertActionCooldown(
    actorKey: string,
    actionKey: string,
    cooldownMs: number,
    message = 'Demasiadas acciones seguidas. Espera un momento.',
  ): void {
    const mapKey = `${actorKey}:${actionKey}`;
    const now = Date.now();
    const last = this.cooldowns.get(mapKey) ?? 0;

    if (last > 0 && now - last < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - (now - last)) / 1000);
      throw new ForbiddenException(`${message} (${waitSec}s)`);
    }

    this.cooldowns.set(mapKey, now);
  }

  isWithinWorldBounds(x: number, y: number, z: number): boolean {
    const MAX_XZ = 2500;
    const MIN_Y = -20;
    const MAX_Y = 500;
    return (
      Math.abs(x) <= MAX_XZ && Math.abs(z) <= MAX_XZ && y >= MIN_Y && y <= MAX_Y
    );
  }

  async recordViolation(params: {
    userId?: string;
    playerId?: string;
    rule: AntiCheatRule;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    evidence?: Record<string, unknown>;
    blocked?: boolean;
  }): Promise<{ strikesInWindow: number; shouldDisconnect: boolean }> {
    const key = params.playerId || params.userId || 'anonymous';
    const now = Date.now();
    const recent = (this.strikeWindow.get(key) ?? []).filter(
      (ts) => now - ts < this.STRIKE_WINDOW_MS,
    );
    recent.push(now);
    this.strikeWindow.set(key, recent);

    const strikesInWindow = recent.length;
    const shouldDisconnect = strikesInWindow >= this.MAX_STRIKES_BEFORE_KICK;

    this.logger.warn(
      `AntiCheat violation [${params.rule}] actor=${key} strikes=${strikesInWindow} evidence=${JSON.stringify(params.evidence ?? {})}`,
    );

    try {
      const repo = (
        this.prisma as unknown as {
          antiCheatIncident?: {
            create?: (args: {
              data: Record<string, unknown>;
            }) => Promise<unknown>;
          };
        }
      )?.antiCheatIncident;
      if (repo?.create) {
        await repo.create({
          data: {
            userId: params.userId ?? null,
            playerId: params.playerId ?? null,
            rule: params.rule,
            severity: params.severity ?? (shouldDisconnect ? 'HIGH' : 'MEDIUM'),
            strikes: strikesInWindow,
            blocked: params.blocked ?? true,
            evidence: params.evidence ?? undefined,
          },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to log AntiCheatIncident: ${msg}`);
    }

    await this.auditService.logEvent({
      actorId: params.userId ?? params.playerId ?? null,
      eventType: `ANTICHEAT_${params.rule}`,
      severity: shouldDisconnect ? 'HIGH' : 'WARN',
      details: {
        strikesInWindow,
        shouldDisconnect,
        ...(params.evidence ?? {}),
      },
    });

    return { strikesInWindow, shouldDisconnect };
  }

  clearActorState(actorKey: string): void {
    this.strikeWindow.delete(actorKey);
  }
}
