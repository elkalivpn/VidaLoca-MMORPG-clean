import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MissionStatus, Difficulty, MissionMode } from '@prisma/client';
import { CreateMissionTemplateDto } from './dto/missions.dto';
import { calculateLevelFromXp } from '../common/utils/level.util';
import { isPlayerVipActive } from '../common/utils/vip.util';
import { grantBattlePassXpTx } from '../common/utils/battle-pass.util';
import { ZONES_BY_ID } from '../common/constants/zones';
import { AntiCheatService } from '../security/anti-cheat.service';
import { EngagementService } from '../engagement/engagement.service';

export interface CoopParticipant {
  playerId: string;
  userId: string;
  displayName: string;
  role: 'LEADER' | 'MEMBER';
  joinedAt: string;
}

@Injectable()
export class MissionsService {
  private readonly STEP_COOLDOWN_MS: Record<Difficulty, number> = {
    EASY: 8_000,
    MEDIUM: 12_000,
    HARD: 18_000,
    SUICIDE: 25_000,
  };

  constructor(
    private prisma: PrismaService,
    @Optional() private readonly antiCheat?: AntiCheatService,
    @Optional() private readonly engagementService?: EngagementService,
  ) {}

  // ─── Templates (Catalog & Admin) ─────────────────────────────────────

  async createTemplate(dto: CreateMissionTemplateDto) {
    return this.prisma.missionTemplate.create({
      data: {
        title: dto.title,
        description: dto.description,
        difficulty: dto.difficulty,
        mode: dto.mode ?? MissionMode.ONLINE_SOLO,
        category: dto.category ?? 'GENERAL',
        city: dto.city ?? null,
        minLevel: dto.minLevel ?? 1,
        minPlayers: dto.minPlayers ?? 1,
        maxPlayers: dto.maxPlayers ?? (dto.mode === MissionMode.ONLINE_COOP ? 4 : 1),
        isOptional: dto.isOptional ?? true,
        isRepeatable: dto.isRepeatable ?? false,
        cooldownHours: dto.cooldownHours ?? 0,
        requiredSteps: dto.requiredSteps ?? 3,
        isVipOnly: dto.isVipOnly ?? false,
        rewardEuros: dto.rewardEuros,
        rewardXp: dto.rewardXp,
        rewardVidaCoins: dto.rewardVidaCoins ?? 0,
        rewardReputation: dto.rewardReputation ?? 0,
        rewardItemName: dto.rewardItemName ?? null,
        unlockBenefit: dto.unlockBenefit ?? null,
        requirement: (dto.requirement as any) ?? undefined,
      },
    });
  }

  async getAllTemplates(
    difficulty?: Difficulty,
    mode?: MissionMode,
    city?: string,
  ) {
    return this.prisma.missionTemplate.findMany({
      where: {
        ...(difficulty ? { difficulty } : {}),
        ...(mode ? { mode } : {}),
        ...(city ? { city } : {}),
      },
      orderBy: [{ mode: 'asc' }, { minLevel: 'asc' }, { difficulty: 'asc' }],
    });
  }

  async getTemplateById(id: string) {
    const template = await this.prisma.missionTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Mission template not found');
    return template;
  }

  // ─── Player missions & Optional Choice ───────────────────────────────

  async getPlayerMissions(userId: string) {
    const player = await this.getPlayerOrThrow(userId);

    const directMissions = await this.prisma.playerMission.findMany({
      where: { playerId: player.id },
      include: { template: true },
      orderBy: { startedAt: 'desc' },
    });

    // Also include active Co-op squads where this player joined as teammate
    const coopCandidates = await this.prisma.playerMission.findMany({
      where: {
        playerId: { not: player.id },
        squadCode: { not: null },
        status: { in: [MissionStatus.IN_PROGRESS, MissionStatus.COMPLETED] },
      },
      include: { template: true },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });

    const joinedCoops = coopCandidates.filter((m) =>
      this.parseCoopParticipants(m.coOpParticipants).some(
        (p) => p.playerId === player.id,
      ),
    );

    return [...directMissions, ...joinedCoops];
  }

  async startMission(userId: string, templateId: string) {
    const player = await this.getPlayerOrThrow(userId);
    this.assertNotJailed(player.jailUntil);
    const template = await this.getTemplateById(templateId);

    if (template.isVipOnly && !isPlayerVipActive(player)) {
      throw new ForbiddenException(
        'Misión exclusiva del Club VIP. Activa tu membresía VIP en Mercado / Club VIP.',
      );
    }

    const active = await this.prisma.playerMission.findFirst({
      where: {
        playerId: player.id,
        templateId,
        status: { in: [MissionStatus.PENDING, MissionStatus.IN_PROGRESS] },
      },
    });

    if (active) {
      throw new BadRequestException('Ya tienes esta misión activa');
    }

    const fallbackLevel: Record<Difficulty, number> = {
      EASY: 1,
      MEDIUM: 5,
      HARD: 15,
      SUICIDE: 30,
    };
    const requiredLevel = Math.max(
      template.minLevel ?? 1,
      template.minLevel ? template.minLevel : fallbackLevel[template.difficulty],
    );

    if (player.level < requiredLevel) {
      throw new ForbiddenException(
        `Necesitas nivel ${requiredLevel} para iniciar "${template.title}"`,
      );
    }

    // Check repeatability and cooldown (prevents beating the game in 2 days via exploit loops)
    const lastCompletion = await this.prisma.completedMission.findFirst({
      where: { playerId: player.id, missionId: templateId },
      orderBy: { completedAt: 'desc' },
    });

    if (lastCompletion) {
      if (!template.isRepeatable) {
        throw new BadRequestException(
          'Ya has completado esta misión de historia/única.',
        );
      }
      if (template.cooldownHours > 0) {
        const readyAt =
          new Date(lastCompletion.completedAt).getTime() +
          template.cooldownHours * 3600_000;
        if (Date.now() < readyAt) {
          const remainingHours = Math.ceil((readyAt - Date.now()) / 3600_000);
          throw new ForbiddenException(
            `Contrato en enfriamiento. Disponible de nuevo en ~${remainingHours}h.`,
          );
        }
      }
    }

    const isCoop = template.mode === MissionMode.ONLINE_COOP;
    const squadCode = isCoop ? this.generateSquadCode() : null;
    const coOpParticipants: CoopParticipant[] | undefined = isCoop
      ? [
          {
            playerId: player.id,
            userId: player.userId,
            displayName: player.displayName,
            role: 'LEADER',
            joinedAt: new Date().toISOString(),
          },
        ]
      : undefined;

    return this.prisma.playerMission.create({
      data: {
        playerId: player.id,
        templateId,
        status: MissionStatus.IN_PROGRESS,
        progress: 0,
        squadCode,
        coOpParticipants: coOpParticipants as any,
      },
      include: { template: true },
    });
  }

  // ─── Online Co-op with Friends ───────────────────────────────────────

  async createCoopSquad(userId: string, templateId: string) {
    const template = await this.getTemplateById(templateId);
    if (template.mode !== MissionMode.ONLINE_COOP) {
      throw new BadRequestException(
        'Solo las misiones ONLINE_COOP permiten crear escuadra con amigos',
      );
    }
    return this.startMission(userId, templateId);
  }

  async getOpenCoopSquads() {
    const squads = await this.prisma.playerMission.findMany({
      where: {
        squadCode: { not: null },
        status: MissionStatus.IN_PROGRESS,
        template: { mode: MissionMode.ONLINE_COOP },
      },
      include: {
        template: true,
        player: { select: { id: true, displayName: true, level: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });

    return squads.filter((m) => {
      const participants = this.parseCoopParticipants(m.coOpParticipants);
      return participants.length < (m.template.maxPlayers ?? 4);
    });
  }

  async joinCoopSquad(userId: string, rawCode: string) {
    const squadCode = (rawCode || '').trim().toUpperCase();
    if (!squadCode) {
      throw new BadRequestException('Código de escuadra requerido');
    }

    const player = await this.getPlayerOrThrow(userId);
    this.assertNotJailed(player.jailUntil);

    const mission = await this.prisma.playerMission.findFirst({
      where: {
        squadCode,
        status: MissionStatus.IN_PROGRESS,
      },
      include: { template: true },
    });

    if (!mission) {
      throw new NotFoundException(
        `No existe ninguna misión cooperativa activa con código ${squadCode}`,
      );
    }

    if (mission.template.isVipOnly && !isPlayerVipActive(player)) {
      throw new ForbiddenException(
        'Misión cooperativa exclusiva del Club VIP. Activa tu membresía VIP en Mercado / Club VIP.',
      );
    }

    if (player.level < (mission.template.minLevel ?? 1)) {
      throw new ForbiddenException(
        `Necesitas nivel ${mission.template.minLevel} para unirte a esta misión`,
      );
    }

    const participants = this.parseCoopParticipants(mission.coOpParticipants);
    if (participants.some((p) => p.playerId === player.id)) {
      throw new BadRequestException('Ya formas parte de esta escuadra');
    }

    const maxPlayers = mission.template.maxPlayers ?? 4;
    if (participants.length >= maxPlayers) {
      throw new BadRequestException('La escuadra ya está completa');
    }

    const nextParticipants: CoopParticipant[] = [
      ...participants,
      {
        playerId: player.id,
        userId: player.userId,
        displayName: player.displayName,
        role: 'MEMBER',
        joinedAt: new Date().toISOString(),
      },
    ];

    return this.prisma.playerMission.update({
      where: { id: mission.id },
      data: { coOpParticipants: nextParticipants as any },
      include: { template: true },
    });
  }

  // ─── Multi-Step Progression (Anti-Speedrun) ──────────────────────────

  async advanceMission(userId: string, missionId: string) {
    const player = await this.getPlayerOrThrow(userId);
    this.assertNotJailed(player.jailUntil);

    const mission = await this.prisma.playerMission.findUnique({
      where: { id: missionId },
      include: { template: true },
    });

    if (!mission) throw new NotFoundException('Misión no encontrada');

    const participants = this.parseCoopParticipants(mission.coOpParticipants);
    const isOwner = mission.playerId === player.id;
    const isMember = participants.some((p) => p.playerId === player.id);

    if (!isOwner && !isMember) {
      throw new ForbiddenException('No participas en esta misión');
    }

    if (mission.status !== MissionStatus.IN_PROGRESS) {
      throw new BadRequestException('La misión no está en curso');
    }

    const tpl = mission.template;

    // Require player to be in the mission's target city if one is specified
    if (tpl.city) {
      const currentZone = ZONES_BY_ID[player.locationId || 'madrid_centro'];
      const currentCity = currentZone?.city;
      if (currentCity && currentCity !== tpl.city) {
        throw new BadRequestException(
          `Debes desplazarte a ${tpl.city} para avanzar en "${tpl.title}" (estás en ${currentCity}).`,
        );
      }
    }

    // Online Co-op missions require minimum crew before advancing
    if (
      tpl.mode === MissionMode.ONLINE_COOP &&
      participants.length < (tpl.minPlayers ?? 2)
    ) {
      throw new BadRequestException(
        `Esta misión con amigos necesita al menos ${tpl.minPlayers} jugadores unidos (código: ${mission.squadCode}).`,
      );
    }

    // Anti-speedrun cooldown between mission steps
    const reqObj = (tpl.requirement ?? {}) as Record<string, unknown>;
    const customStepMs =
      typeof reqObj.minStepSeconds === 'number' && reqObj.minStepSeconds > 0
        ? reqObj.minStepSeconds * 1000
        : this.STEP_COOLDOWN_MS[tpl.difficulty];

    if (mission.lastStepAt) {
      const elapsed = Date.now() - new Date(mission.lastStepAt).getTime();
      if (elapsed < customStepMs) {
        const waitSec = Math.ceil((customStepMs - elapsed) / 1000);
        await this.antiCheat?.recordViolation({
          userId,
          playerId: player.id,
          rule: 'MISSION_SPEEDRUN',
          severity: 'LOW',
          evidence: { missionId, elapsed, requiredMs: customStepMs },
        });
        throw new ForbiddenException(
          `Operación táctica en curso. Espera ${waitSec}s antes de ejecutar la siguiente fase.`,
        );
      }
    }

    const steps = Math.max(1, tpl.requiredSteps ?? 3);
    const stepPct = Math.ceil(100 / steps);
    const newProgress = Math.min(100, mission.progress + stepPct);
    const nextStatus =
      newProgress >= 100 ? MissionStatus.COMPLETED : MissionStatus.IN_PROGRESS;

    const updated = await this.prisma.playerMission.update({
      where: { id: mission.id },
      data: {
        progress: newProgress,
        status: nextStatus,
        lastStepAt: new Date(),
        completedAt: nextStatus === MissionStatus.COMPLETED ? new Date() : undefined,
      },
      include: { template: true },
    });

    const completedSteps = Math.min(
      steps,
      Math.ceil((newProgress / 100) * steps),
    );

    return {
      ...updated,
      stepInfo: {
        completedSteps,
        totalSteps: steps,
        completed: nextStatus === MissionStatus.COMPLETED,
        nextStepDelaySec: Math.ceil(customStepMs / 1000),
      },
    };
  }

  // ─── Optional Abandon / Skip ─────────────────────────────────────────

  async abandonMission(userId: string, missionId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const mission = await this.prisma.playerMission.findFirst({
      where: { id: missionId, playerId: player.id },
      include: { template: true },
    });

    if (!mission) throw new NotFoundException('Misión no encontrada');
    if (
      mission.status !== MissionStatus.IN_PROGRESS &&
      mission.status !== MissionStatus.PENDING
    ) {
      throw new BadRequestException('Solo puedes abandonar misiones activas');
    }

    return this.prisma.playerMission.update({
      where: { id: mission.id },
      data: { status: MissionStatus.ABANDONED },
      include: { template: true },
    });
  }

  async skipMission(userId: string, templateId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const template = await this.getTemplateById(templateId);

    if (template.isOptional === false) {
      throw new BadRequestException('Esta misión es obligatoria y no se puede omitir');
    }

    const active = await this.prisma.playerMission.findFirst({
      where: {
        playerId: player.id,
        templateId,
        status: { in: [MissionStatus.PENDING, MissionStatus.IN_PROGRESS] },
      },
    });

    if (active) {
      return this.prisma.playerMission.update({
        where: { id: active.id },
        data: { status: MissionStatus.SKIPPED },
        include: { template: true },
      });
    }

    return this.prisma.playerMission.create({
      data: {
        playerId: player.id,
        templateId,
        status: MissionStatus.SKIPPED,
        progress: 0,
      },
      include: { template: true },
    });
  }

  // ─── Admin Progress Override ─────────────────────────────────────────

  async updateProgress(userId: string, missionId: string, progress: number) {
    const player = await this.getPlayerOrThrow(userId);
    const mission = await this.prisma.playerMission.findFirst({
      where: { id: missionId, playerId: player.id },
      include: { template: true },
    });

    if (!mission) throw new NotFoundException('Mission not found');
    if (mission.status !== MissionStatus.IN_PROGRESS) {
      throw new BadRequestException('Mission is not in progress');
    }

    const newProgress = Math.min(100, Math.max(0, progress));
    const status =
      newProgress >= 100 ? MissionStatus.COMPLETED : MissionStatus.IN_PROGRESS;

    return this.prisma.playerMission.update({
      where: { id: missionId },
      data: {
        progress: newProgress,
        status,
        lastStepAt: new Date(),
        completedAt: status === MissionStatus.COMPLETED ? new Date() : undefined,
      },
      include: { template: true },
    });
  }

  // ─── Claim Rewards + Item Unlock + Co-op Bonus + Battle Pass XP ──────

  async claimReward(userId: string, missionId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const mission = await this.prisma.playerMission.findUnique({
      where: { id: missionId },
      include: { template: true },
    });

    if (!mission) throw new NotFoundException('Mission not found');

    const participants = this.parseCoopParticipants(mission.coOpParticipants);
    const isOwner = mission.playerId === player.id;
    const isMember = participants.some((p) => p.playerId === player.id);

    if (!isOwner && !isMember) {
      throw new ForbiddenException('No formas parte de esta misión');
    }

    if (mission.status !== MissionStatus.COMPLETED) {
      throw new BadRequestException('Mission is not completed yet');
    }

    const tpl = mission.template;

    if (!tpl.isRepeatable) {
      const alreadyClaimed = await this.prisma.completedMission.findFirst({
        where: {
          playerId: player.id,
          missionId: mission.templateId,
          rewardClaimed: true,
        },
      });
      if (alreadyClaimed) {
        throw new BadRequestException('Reward already claimed');
      }
    }

    // Co-op crew multiplier (+20% XP & Euros when playing with friends)
    const isTeamBonus =
      tpl.mode === MissionMode.ONLINE_COOP && participants.length > 1;
    const bonusMultiplier = isTeamBonus ? 1.2 : 1.0;

    const isVipActive = isPlayerVipActive(player as { isVip?: boolean; vipExpiresAt?: Date | null });
    const eurosMultiplier = bonusMultiplier * (isVipActive ? 1.15 : 1.0);
    const xpMultiplier = bonusMultiplier * (isVipActive ? 1.25 : 1.0);

    const grantedEuros = Math.round(tpl.rewardEuros * eurosMultiplier);
    const grantedXp = Math.round(tpl.rewardXp * xpMultiplier);
    const grantedVidaCoins = tpl.rewardVidaCoins ?? 0;
    const grantedReputation = tpl.rewardReputation ?? 0;
    const battlePassXpGain = Math.max(10, Math.round(grantedXp * 0.25));

    const claimResult = await this.prisma.$transaction(async (tx) => {
      // Atomic status transition to prevent concurrent double-claim exploit
      const claimGuard = await tx.playerMission.updateMany({
        where: {
          id: missionId,
          status: MissionStatus.COMPLETED,
        },
        data: { status: MissionStatus.CLAIMED },
      });

      if (claimGuard.count === 0) {
        await this.antiCheat?.recordViolation({
          userId,
          playerId: player.id,
          rule: 'DOUBLE_CLAIM',
          severity: 'HIGH',
          evidence: { missionId },
        });
        throw new BadRequestException('Reward already claimed');
      }

      // Reward either single player or all Co-op participants
      const targetPlayerIds = isTeamBonus
        ? Array.from(new Set([mission.playerId, ...participants.map((p) => p.playerId)]))
        : [player.id];

      let callerUpdatedPlayer = player;
      let unlockedItem: { id: string; name: string; rarity: string } | null =
        null;

      for (const pid of targetPlayerIds) {
        const dbPlayer =
          pid === player.id
            ? player
            : await tx.player.findUnique({ where: { id: pid } });
        if (!dbPlayer) continue;

        await tx.completedMission.create({
          data: {
            playerId: dbPlayer.id,
            missionId: mission.templateId,
            rewardClaimed: true,
          },
        });

        const newXp = dbPlayer.xp + grantedXp;
        const calcLevel = calculateLevelFromXp(newXp);
        const newLevel = calcLevel > dbPlayer.level ? calcLevel : dbPlayer.level;

        const updatedP = await tx.player.update({
          where: { id: dbPlayer.id },
          data: {
            euros: { increment: grantedEuros },
            xp: newXp,
            level: newLevel,
            vidaCoins: { increment: grantedVidaCoins },
            reputation: { increment: grantedReputation },
          },
        });

        if (dbPlayer.id === player.id) {
          callerUpdatedPlayer = updatedP;
        }

        await tx.transactionLog.create({
          data: {
            playerId: dbPlayer.id,
            type: 'EARN',
            amount: grantedEuros,
            currency: 'EUR',
            reason: `Mission reward: ${tpl.title}${isTeamBonus ? ' (Co-op +20%)' : ''}${isVipActive ? ' (VIP +15%)' : ''}`,
            reference: missionId,
          },
        });

        // Grant Battle Pass XP (unified 200 XP/level curve + auto-init)
        await grantBattlePassXpTx(tx, dbPlayer.id, battlePassXpGain);

        // Direct item unlock benefit
        if (tpl.rewardItemName && (tx as any).itemTemplate?.findFirst) {
          const itemTpl = await tx.itemTemplate.findFirst({
            where: { name: tpl.rewardItemName },
          });
          if (itemTpl) {
            const existingInv = await tx.inventoryItem.findFirst({
              where: { playerId: dbPlayer.id, templateId: itemTpl.id },
            });
            if (existingInv) {
              await tx.inventoryItem.update({
                where: { id: existingInv.id },
                data: { quantity: { increment: 1 } },
              });
            } else {
              await tx.inventoryItem.create({
                data: {
                  playerId: dbPlayer.id,
                  templateId: itemTpl.id,
                  quantity: 1,
                },
              });
            }
            if (dbPlayer.id === player.id) {
              unlockedItem = {
                id: itemTpl.id,
                name: itemTpl.name,
                rarity: itemTpl.rarity,
              };
            }
          }
        }
      }

      return {
        mission: { ...mission, status: MissionStatus.CLAIMED },
        rewards: {
          euros: grantedEuros,
          xp: grantedXp,
          vidaCoins: grantedVidaCoins,
          reputation: grantedReputation,
          battlePassXp: battlePassXpGain,
          coopBonusApplied: isTeamBonus,
          vipBonusApplied: isVipActive,
          unlockedItem,
        },
        player: {
          euros: callerUpdatedPlayer.euros,
          xp: callerUpdatedPlayer.xp,
          level: callerUpdatedPlayer.level,
          vidaCoins: callerUpdatedPlayer.vidaCoins,
          reputation: callerUpdatedPlayer.reputation,
        },
      };
    });
    if (this.engagementService) {
      await this.engagementService
        .recordProgress(player.id, 'mission')
        .catch(() => undefined);
    }
    return claimResult;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
    });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }

  private assertNotJailed(jailUntil?: Date | null) {
    if (jailUntil && new Date(jailUntil).getTime() > Date.now()) {
      const remainingSec = Math.ceil(
        (new Date(jailUntil).getTime() - Date.now()) / 1000,
      );
      throw new ForbiddenException(
        `Estás en el calabozo (${remainingSec}s restantes). No puedes realizar misiones.`,
      );
    }
  }

  private generateSquadCode(): string {
    return `VL-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private parseCoopParticipants(raw: unknown): CoopParticipant[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is CoopParticipant =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as any).playerId === 'string',
    );
  }
}
