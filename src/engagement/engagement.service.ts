import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { calculateLevelFromXp } from '../common/utils/level.util';
import { grantBattlePassXpTx } from '../common/utils/battle-pass.util';
import { isPlayerVipActive } from '../common/utils/vip.util';

export interface DailyStreakReward {
  day: number;
  euros: number;
  vidaCoins: number;
  xp: number;
}

export const DAILY_STREAK_REWARDS: DailyStreakReward[] = [
  { day: 1, euros: 300, vidaCoins: 0, xp: 60 },
  { day: 2, euros: 600, vidaCoins: 0, xp: 100 },
  { day: 3, euros: 1000, vidaCoins: 10, xp: 150 },
  { day: 4, euros: 1500, vidaCoins: 0, xp: 220 },
  { day: 5, euros: 2200, vidaCoins: 20, xp: 320 },
  { day: 6, euros: 3200, vidaCoins: 0, xp: 450 },
  { day: 7, euros: 5000, vidaCoins: 50, xp: 700 },
];

export type ChallengeMetric = 'action' | 'travel' | 'trade' | 'mission';

export interface DailyChallengeDef {
  id: string;
  title: string;
  description: string;
  metric: ChallengeMetric;
  target: number;
  rewardEuros: number;
  rewardXp: number;
  rewardVidaCoins: number;
}

interface DailyProgressState {
  date: string;
  action: number;
  travel: number;
  trade: number;
  mission: number;
  claimed: string[];
}

const CHALLENGE_POOL: DailyChallengeDef[] = [
  {
    id: 'daily_street_3',
    title: 'Pulso de Calle',
    description: 'Completa 3 acciones en cualquier distrito de España.',
    metric: 'action',
    target: 3,
    rewardEuros: 900,
    rewardXp: 180,
    rewardVidaCoins: 5,
  },
  {
    id: 'daily_travel_2',
    title: 'Kilómetro Cero',
    description: 'Viaja 2 veces entre ciudades por la red de autopistas.',
    metric: 'travel',
    target: 2,
    rewardEuros: 1100,
    rewardXp: 210,
    rewardVidaCoins: 5,
  },
  {
    id: 'daily_trade_2',
    title: 'Bróker Urbano',
    description: 'Realiza 2 operaciones en el mercado regional.',
    metric: 'trade',
    target: 2,
    rewardEuros: 1300,
    rewardXp: 240,
    rewardVidaCoins: 8,
  },
  {
    id: 'daily_mission_1',
    title: 'Contrato Cumplido',
    description: 'Completa al menos 1 misión de historia, solo o co-op.',
    metric: 'mission',
    target: 1,
    rewardEuros: 1600,
    rewardXp: 300,
    rewardVidaCoins: 10,
  },
];

@Injectable()
export class EngagementService {
  private leaderboardCache: {
    expiresAt: number;
    data: unknown;
  } | null = null;

  constructor(private prisma: PrismaService) {}

  private getTodayKey(now = new Date()): string {
    return now.toISOString().slice(0, 10);
  }

  private getTodaysChallenges(dateKey: string): DailyChallengeDef[] {
    // Deterministic 3-of-4 daily rotation based on date
    const daySeed = Number(dateKey.replace(/-/g, '')) || 1;
    const skipIndex = daySeed % CHALLENGE_POOL.length;
    return CHALLENGE_POOL.filter((_, idx) => idx !== skipIndex);
  }

  private normalizeProgress(
    dateKey: string,
    storedDate: string | null | undefined,
    rawProgress: unknown,
  ): DailyProgressState {
    if (
      storedDate === dateKey &&
      rawProgress &&
      typeof rawProgress === 'object'
    ) {
      const p = rawProgress as Partial<DailyProgressState>;
      return {
        date: dateKey,
        action: Number(p.action) || 0,
        travel: Number(p.travel) || 0,
        trade: Number(p.trade) || 0,
        mission: Number(p.mission) || 0,
        claimed: Array.isArray(p.claimed) ? p.claimed.map(String) : [],
      };
    }
    return {
      date: dateKey,
      action: 0,
      travel: 0,
      trade: 0,
      mission: 0,
      claimed: [],
    };
  }

  private computeStreakWindow(lastDailyClaimAt: Date | null, currentStreak: number, now: Date) {
    if (!lastDailyClaimAt) {
      return { canClaimDaily: true, nextDay: 1, effectiveStreak: 0 };
    }
    const elapsedMs = now.getTime() - lastDailyClaimAt.getTime();
    const hours = elapsedMs / (1000 * 60 * 60);
    if (hours < 20) {
      return {
        canClaimDaily: false,
        nextDay: ((currentStreak - 1) % 7) + 1,
        effectiveStreak: currentStreak,
        nextClaimAt: new Date(lastDailyClaimAt.getTime() + 20 * 60 * 60 * 1000),
      };
    }
    if (hours > 48) {
      return { canClaimDaily: true, nextDay: 1, effectiveStreak: 0 };
    }
    const nextDay = (currentStreak % 7) + 1;
    return { canClaimDaily: true, nextDay, effectiveStreak: currentStreak };
  }

  async getStatus(userId: string) {
    let player = await this.prisma.player.findUnique({
      where: { userId },
      include: { user: { select: { isGuest: true } } },
    });
    if (!player) throw new NotFoundException('Player not found');

    if (!player.referralCode) {
      const code = `VL-${randomBytes(3).toString('hex').toUpperCase()}`;
      player = await this.prisma.player.update({
        where: { id: player.id },
        data: { referralCode: code },
        include: { user: { select: { isGuest: true } } },
      });
    }

    const now = new Date();
    const dateKey = this.getTodayKey(now);
    const streakInfo = this.computeStreakWindow(
      player.lastDailyClaimAt,
      player.loginStreak,
      now,
    );
    const nextReward =
      DAILY_STREAK_REWARDS[streakInfo.nextDay - 1] ?? DAILY_STREAK_REWARDS[0];

    const progressState = this.normalizeProgress(
      dateKey,
      player.dailyChallengesDate,
      player.dailyChallengesProgress,
    );
    const dailyChallenges = this.getTodaysChallenges(dateKey).map((ch) => ({
      ...ch,
      progress: Math.min(ch.target, progressState[ch.metric] || 0),
      claimed: progressState.claimed.includes(ch.id),
    }));

    const referralsCount = await this.prisma.player.count({
      where: { referredByPlayerId: player.id },
    });

    const isVipActive =
      Boolean(player.isVip) &&
      (!player.vipExpiresAt || player.vipExpiresAt > now);

    return {
      isGuest: Boolean(player.user?.isGuest),
      loginStreak: streakInfo.effectiveStreak,
      canClaimDaily: streakInfo.canClaimDaily,
      nextClaimAt: streakInfo.nextClaimAt ?? null,
      nextDay: streakInfo.nextDay,
      nextReward,
      streakTable: DAILY_STREAK_REWARDS,
      referralCode: player.referralCode,
      referralsCount,
      isVip: isVipActive,
      vipExpiresAt: isVipActive ? player.vipExpiresAt : null,
      dailyChallenges,
    };
  }

  async claimDaily(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');

    const now = new Date();
    const streakInfo = this.computeStreakWindow(
      player.lastDailyClaimAt,
      player.loginStreak,
      now,
    );

    if (!streakInfo.canClaimDaily) {
      throw new BadRequestException(
        'Ya has reclamado tu recompensa diaria. Vuelve en unas horas.',
      );
    }

    const reward =
      DAILY_STREAK_REWARDS[streakInfo.nextDay - 1] ?? DAILY_STREAK_REWARDS[0];
    const isVipActive =
      Boolean(player.isVip) &&
      (!player.vipExpiresAt || player.vipExpiresAt > now);
    const xpGain = isVipActive ? Math.round(reward.xp * 1.25) : reward.xp;

    const cutoff = new Date(now.getTime() - 20 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const guard = await tx.player.updateMany({
        where: {
          id: player.id,
          OR: [
            { lastDailyClaimAt: null },
            { lastDailyClaimAt: { lte: cutoff } },
          ],
        },
        data: {
          loginStreak: streakInfo.nextDay,
          lastDailyClaimAt: now,
        },
      });

      if (guard.count === 0) {
        throw new BadRequestException(
          'Recompensa diaria ya reclamada recientemente',
        );
      }

      const nextXp = player.xp + xpGain;
      const nextLevel = Math.max(player.level, calculateLevelFromXp(nextXp));

      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          euros: { increment: reward.euros },
          vidaCoins: { increment: reward.vidaCoins },
          xp: nextXp,
          level: nextLevel,
        },
      });

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'GIFT',
          amount: reward.euros,
          currency: 'EUR',
          reason: `Racha diaria día ${streakInfo.nextDay}`,
        },
      });

      if (reward.vidaCoins > 0) {
        await tx.transactionLog.create({
          data: {
            playerId: player.id,
            type: 'GIFT',
            amount: reward.vidaCoins,
            currency: 'VIDACOIN',
            reason: `Racha diaria día ${streakInfo.nextDay} (VidaCoins)`,
          },
        });
      }

      const battlePassXp = 35;
      await grantBattlePassXpTx(tx, player.id, battlePassXp);

      return {
        day: streakInfo.nextDay,
        reward: { ...reward, xp: xpGain, battlePassXp },
        player: {
          euros: updated.euros,
          vidaCoins: updated.vidaCoins,
          xp: updated.xp,
          level: updated.level,
          loginStreak: updated.loginStreak,
        },
      };
    });
  }

  async recordProgress(playerId: string, metric: ChallengeMetric) {
    const now = new Date();
    const dateKey = this.getTodayKey(now);

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        dailyChallengesDate: true,
        dailyChallengesProgress: true,
      },
    });
    if (!player) return;

    const state = this.normalizeProgress(
      dateKey,
      player.dailyChallengesDate,
      player.dailyChallengesProgress,
    );
    state[metric] = (state[metric] || 0) + 1;

    await this.prisma.player.update({
      where: { id: playerId },
      data: {
        dailyChallengesDate: dateKey,
        dailyChallengesProgress: state as object,
      },
    });
  }

  async claimChallenge(userId: string, challengeId: string) {
    const now = new Date();
    const dateKey = this.getTodayKey(now);
    const todays = this.getTodaysChallenges(dateKey);
    const def = todays.find((c) => c.id === challengeId);
    if (!def) {
      throw new BadRequestException('Reto diario no disponible hoy');
    }

    const challengeRef = `daily-challenge:${def.id}:${dateKey}`;

    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) throw new NotFoundException('Player not found');

      const alreadyClaimedTx = await tx.transactionLog.findFirst?.({
        where: { playerId: player.id, reference: challengeRef },
        select: { id: true },
      });
      if (alreadyClaimedTx) {
        throw new BadRequestException('Ya reclamaste este reto diario');
      }

      const state = this.normalizeProgress(
        dateKey,
        player.dailyChallengesDate,
        player.dailyChallengesProgress,
      );

      if (state.claimed.includes(challengeId)) {
        throw new BadRequestException('Ya reclamaste este reto diario');
      }
      if ((state[def.metric] || 0) < def.target) {
        throw new BadRequestException(
          `Aún te falta completar el reto (${state[def.metric] || 0}/${def.target})`,
        );
      }

      state.claimed.push(challengeId);
      const isVipActive =
        Boolean(player.isVip) &&
        (!player.vipExpiresAt || player.vipExpiresAt > now);
      const xpGain = isVipActive ? Math.round(def.rewardXp * 1.25) : def.rewardXp;
      const nextXp = player.xp + xpGain;
      const nextLevel = Math.max(player.level, calculateLevelFromXp(nextXp));

      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          dailyChallengesDate: dateKey,
          dailyChallengesProgress: state as object,
          euros: { increment: def.rewardEuros },
          vidaCoins: { increment: def.rewardVidaCoins },
          xp: nextXp,
          level: nextLevel,
        },
      });

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'EARN',
          amount: def.rewardEuros,
          currency: 'EUR',
          reason: `Reto diario: ${def.title}`,
          reference: challengeRef,
        },
      });

      if (def.rewardVidaCoins > 0) {
        await tx.transactionLog.create({
          data: {
            playerId: player.id,
            type: 'EARN',
            amount: def.rewardVidaCoins,
            currency: 'VIDACOIN',
            reason: `Reto diario: ${def.title}`,
            reference: challengeRef,
          },
        });
      }

      const battlePassXp = Math.max(25, Math.round(xpGain * 0.35));
      await grantBattlePassXpTx(tx, player.id, battlePassXp);

      return {
        challengeId: def.id,
        reward: {
          euros: def.rewardEuros,
          xp: xpGain,
          vidaCoins: def.rewardVidaCoins,
          battlePassXp,
        },
        player: {
          euros: updated.euros,
          vidaCoins: updated.vidaCoins,
          xp: updated.xp,
          level: updated.level,
        },
      };
    });
  }

  async getLeaderboards() {
    const nowMs = Date.now();
    if (this.leaderboardCache && this.leaderboardCache.expiresAt > nowMs) {
      return this.leaderboardCache.data;
    }

    const selectPlayer = {
      id: true,
      displayName: true,
      level: true,
      xp: true,
      euros: true,
      reputation: true,
      heat: true,
      faction: true,
      isVip: true,
      locationId: true,
      clanMember: {
        select: {
          clan: { select: { name: true, tag: true } },
        },
      },
    };

    const [richest, topLevel, mostWanted, topClans] = await Promise.all([
      this.prisma.player.findMany({
        take: 10,
        orderBy: { euros: 'desc' },
        select: selectPlayer,
      }),
      this.prisma.player.findMany({
        take: 10,
        orderBy: [{ level: 'desc' }, { xp: 'desc' }],
        select: selectPlayer,
      }),
      this.prisma.player.findMany({
        take: 10,
        where: { heat: { gt: 0 } },
        orderBy: { heat: 'desc' },
        select: selectPlayer,
      }),
      this.prisma.clan.findMany({
        take: 10,
        orderBy: [{ level: 'desc' }, { funds: 'desc' }],
        select: {
          id: true,
          name: true,
          tag: true,
          level: true,
          funds: true,
          _count: {
            select: { members: true, controlledTerritories: true },
          },
        },
      }),
    ]);

    const formatPlayer = (p: (typeof richest)[number]) => ({
      id: p.id,
      displayName: p.displayName,
      level: p.level,
      euros: Math.round(p.euros),
      reputation: p.reputation,
      heat: p.heat,
      faction: p.faction,
      isVip: p.isVip,
      locationId: p.locationId,
      clanTag: p.clanMember?.clan?.tag ?? null,
    });

    const data = {
      richest: richest.map(formatPlayer),
      topLevel: topLevel.map(formatPlayer),
      mostWanted: mostWanted.map(formatPlayer),
      topClans: topClans.map((c) => ({
        id: c.id,
        name: c.name,
        tag: c.tag,
        level: c.level,
        funds: Math.round(c.funds),
        membersCount: c._count.members,
        territoriesCount: c._count.controlledTerritories,
      })),
      cachedAt: new Date(nowMs).toISOString(),
    };

    this.leaderboardCache = {
      expiresAt: nowMs + 30_000,
      data,
    };

    return data;
  }

  public static readonly WORLD_EVENTS = [
    {
      id: 'madrid_convoy',
      title: 'Convoy Blindado en Gran Vía',
      city: 'Madrid',
      zoneId: 'madrid_centro',
      description:
        'Un furgón corporativo cruza el centro con reservas limpias. Intercepta o escolta el envío.',
      rewardEuros: 750,
      rewardXp: 90,
      rewardVidaCoins: 2,
    },
    {
      id: 'marbella_subasta',
      title: 'Subasta Relámpago en Puerto Banús',
      city: 'Marbella',
      zoneId: 'puerto_banus',
      description:
        'Coleccionistas privados liquidan activos de lujo junto a los megayates.',
      rewardEuros: 900,
      rewardXp: 85,
      rewardVidaCoins: 3,
    },
    {
      id: 'barcelona_redada',
      title: 'Operación Nocturna en El Raval',
      city: 'Barcelona',
      zoneId: 'barcelona_ramblas',
      description:
        'Movimiento coordinado entre puertos y callejones del Barrio Gótico.',
      rewardEuros: 700,
      rewardXp: 110,
      rewardVidaCoins: 2,
    },
    {
      id: 'vigo_ria',
      title: 'Desembarco en la Ría de Vigo',
      city: 'Vigo',
      zoneId: 'vigo_puerto',
      description:
        'Descarga nocturna de contenedores de alto valor bajo niebla atlántica.',
      rewardEuros: 800,
      rewardXp: 95,
      rewardVidaCoins: 2,
    },
    {
      id: 'valencia_drift',
      title: 'Circuito Drift en Ciudad de las Artes',
      city: 'Valencia',
      zoneId: 'valencia_artes',
      description:
        'Reto callejero cronometrado con apuestas en vivo sobre el asfalto.',
      rewardEuros: 680,
      rewardXp: 120,
      rewardVidaCoins: 2,
    },
    {
      id: 'sansebastian_cumbre',
      title: 'Cumbre Privada en La Concha',
      city: 'San Sebastián',
      zoneId: 'sansebastian_concha',
      description:
        'Acuerdos de alto nivel en la bahía con comisiones exprés garantizadas.',
      rewardEuros: 950,
      rewardXp: 90,
      rewardVidaCoins: 3,
    },
    {
      id: 'ibiza_botafoch',
      title: 'Noche Dorada en Marina Botafoch',
      city: 'Ibiza',
      zoneId: 'ibiza_daltvila',
      description:
        'Fiesta exclusiva VIP y movimiento de divisas entre clubes baleares.',
      rewardEuros: 1000,
      rewardXp: 100,
      rewardVidaCoins: 3,
    },
    {
      id: 'canarias_franca',
      title: 'Ruta Franca en Puerto de La Luz',
      city: 'Las Palmas',
      zoneId: 'laspalmas_canteras',
      description:
        'Ventana libre de aranceles en el puente tricontinental atlántico.',
      rewardEuros: 780,
      rewardXp: 105,
      rewardVidaCoins: 2,
    },
  ];

  private getCurrentWorldEventWindow(now = new Date()) {
    const hourIndex = Math.floor(now.getTime() / 3600_000);
    const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const event =
      EngagementService.WORLD_EVENTS[
        hourIndex % EngagementService.WORLD_EVENTS.length
      ];
    const endMs = (hourIndex + 1) * 3600_000;
    const remainingSeconds = Math.max(0, Math.ceil((endMs - now.getTime()) / 1000));
    return {
      hourKey,
      event,
      endsAt: new Date(endMs).toISOString(),
      remainingSeconds,
    };
  }

  async getWorldEventStatus(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');

    const now = new Date();
    const { hourKey, event, endsAt, remainingSeconds } =
      this.getCurrentWorldEventWindow(now);
    const eventRef = `world-event:${hourKey}`;

    const [existingClaim, recentActivity] = await Promise.all([
      this.prisma.transactionLog.findFirst?.({
        where: { playerId: player.id, reference: eventRef },
        select: { id: true },
      }) ?? Promise.resolve(null),
      this.prisma.transactionLog.findMany?.({
        where: { playerId: player.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          type: true,
          amount: true,
          currency: true,
          reason: true,
          createdAt: true,
        },
      }) ?? Promise.resolve([]),
    ]);

    return {
      hourKey,
      event,
      endsAt,
      remainingSeconds,
      participated: Boolean(existingClaim),
      isVip: isPlayerVipActive(player),
      recentActivity,
    };
  }

  async participateInWorldEvent(userId: string) {
    const now = new Date();
    const { hourKey, event } = this.getCurrentWorldEventWindow(now);
    const eventRef = `world-event:${hourKey}`;

    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) throw new NotFoundException('Player not found');

      const alreadyClaimed = await tx.transactionLog.findFirst?.({
        where: { playerId: player.id, reference: eventRef },
        select: { id: true },
      });

      if (alreadyClaimed) {
        throw new BadRequestException(
          'Ya participaste en el evento mundial de esta hora. Vuelve en la siguiente hora.',
        );
      }

      const isVipActive = isPlayerVipActive(player);
      const grantedEuros = Math.round(
        event.rewardEuros * (isVipActive ? 1.15 : 1.0),
      );
      const grantedXp = Math.round(event.rewardXp * (isVipActive ? 1.25 : 1.0));
      const grantedVidaCoins = event.rewardVidaCoins + (isVipActive ? 1 : 0);
      const battlePassXp = 40;

      const nextXp = player.xp + grantedXp;
      const nextLevel = Math.max(player.level, calculateLevelFromXp(nextXp));

      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          euros: { increment: grantedEuros },
          vidaCoins: { increment: grantedVidaCoins },
          xp: nextXp,
          level: nextLevel,
        },
      });

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'EARN',
          amount: grantedEuros,
          currency: 'EUR',
          reason: `Evento Mundial: ${event.title}${isVipActive ? ' (VIP +15%)' : ''}`,
          reference: eventRef,
        },
      });

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'EARN',
          amount: grantedVidaCoins,
          currency: 'VIDACOIN',
          reason: `Evento Mundial: ${event.title} (VC)`,
          reference: eventRef,
        },
      });

      await grantBattlePassXpTx(tx, player.id, battlePassXp);

      return {
        hourKey,
        eventId: event.id,
        title: event.title,
        city: event.city,
        vipBonusApplied: isVipActive,
        reward: {
          euros: grantedEuros,
          xp: grantedXp,
          vidaCoins: grantedVidaCoins,
          battlePassXp,
        },
        player: {
          euros: updated.euros,
          vidaCoins: updated.vidaCoins,
          xp: updated.xp,
          level: updated.level,
        },
      };
    });
  }
}
