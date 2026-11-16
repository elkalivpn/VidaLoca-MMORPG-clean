import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isPlayerVipActive } from '../common/utils/vip.util';
import {
  BATTLE_PASS_PREMIUM_PRICE_VC,
  BATTLE_PASS_XP_PER_LEVEL,
  calculateBattlePassReward,
  grantBattlePassXpTx,
} from '../common/utils/battle-pass.util';

@Injectable()
export class BattlePassService {
  constructor(private prisma: PrismaService) {}

  async getActiveSeason() {
    const season = await this.prisma.battlePassSeason.findFirst({
      where: { isActive: true },
    });
    if (!season) throw new NotFoundException('No active battle pass season');
    return season;
  }

  async getPlayerProgress(userId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const season = await this.getActiveSeason();

    let progress = await this.prisma.battlePassProgress.findUnique({
      where: { playerId: player.id },
      include: { season: true },
    });

    if (!progress) {
      progress = await this.prisma.battlePassProgress.create({
        data: {
          playerId: player.id,
          seasonId: season.id,
          level: 1,
          xp: 0,
          isPremium: false,
          rewardsClaimed: [],
        },
        include: { season: true },
      });
    } else if (progress.seasonId !== season.id) {
      progress = await this.prisma.battlePassProgress.update({
        where: { id: progress.id },
        data: {
          seasonId: season.id,
          level: 1,
          xp: 0,
          isPremium: false,
          rewardsClaimed: [],
        },
        include: { season: true },
      });
    }

    const hasClubVip = isPlayerVipActive(player);
    return {
      ...progress,
      hasClubVip,
      effectivePremium: progress.isPremium || hasClubVip,
      premiumPriceVida: BATTLE_PASS_PREMIUM_PRICE_VC,
      xpPerLevel: BATTLE_PASS_XP_PER_LEVEL,
    };
  }

  async unlockPremium(userId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const season = await this.getActiveSeason();

    if (isPlayerVipActive(player)) {
      throw new BadRequestException(
        'Ya disfrutas del Pase Premium gratis gracias a tu membresía Club VIP activa',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let progress = await tx.battlePassProgress.findUnique({
        where: { playerId: player.id },
      });

      if (!progress) {
        progress = await tx.battlePassProgress.create({
          data: {
            playerId: player.id,
            seasonId: season.id,
            level: 1,
            xp: 0,
            isPremium: false,
            rewardsClaimed: [],
          },
        });
      } else if (progress.seasonId !== season.id) {
        progress = await tx.battlePassProgress.update({
          where: { id: progress.id },
          data: {
            seasonId: season.id,
            level: 1,
            xp: 0,
            isPremium: false,
            rewardsClaimed: [],
          },
        });
      }

      if (progress.isPremium) {
        throw new BadRequestException(
          'Ya tienes el Pase Premium desbloqueado en esta temporada',
        );
      }

      const debit = await tx.player.updateMany({
        where: {
          id: player.id,
          vidaCoins: { gte: BATTLE_PASS_PREMIUM_PRICE_VC },
        },
        data: {
          vidaCoins: { decrement: BATTLE_PASS_PREMIUM_PRICE_VC },
        },
      });

      if (debit.count === 0) {
        throw new BadRequestException(
          `VidaCoins insuficientes (requiere ${BATTLE_PASS_PREMIUM_PRICE_VC} VC)`,
        );
      }

      const updated = await tx.battlePassProgress.update({
        where: { id: progress.id },
        data: { isPremium: true },
        include: { season: true },
      });

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'SPEND',
          amount: BATTLE_PASS_PREMIUM_PRICE_VC,
          currency: 'VIDACOIN',
          reason: `Battle Pass Premium: ${season.name}`,
          reference: season.id,
        },
      });

      return {
        progress: {
          ...updated,
          hasClubVip: isPlayerVipActive(player),
          effectivePremium: true,
          premiumPriceVida: BATTLE_PASS_PREMIUM_PRICE_VC,
          xpPerLevel: BATTLE_PASS_XP_PER_LEVEL,
        },
        vidaCoinsSpent: BATTLE_PASS_PREMIUM_PRICE_VC,
      };
    });
  }

  async addXp(userId: string, amount: number) {
    const player = await this.getPlayerOrThrow(userId);
    await this.getPlayerProgress(userId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await grantBattlePassXpTx(tx, player.id, amount);
      return updated;
    });
  }

  async claimReward(userId: string, level: number) {
    const player = await this.getPlayerOrThrow(userId);
    const progress = await this.getPlayerProgress(userId);

    if (level > progress.level) {
      throw new BadRequestException('You have not reached this level yet');
    }

    if (progress.rewardsClaimed.includes(level)) {
      throw new BadRequestException('Reward already claimed');
    }

    const effectivePremium = Boolean(progress.effectivePremium);
    const reward = calculateBattlePassReward(level, effectivePremium);

    return this.prisma.$transaction(async (tx) => {
      const claimGuard = await tx.battlePassProgress.updateMany({
        where: {
          id: progress.id,
          rewardsClaimed: { equals: progress.rewardsClaimed },
        },
        data: {
          rewardsClaimed: { push: level },
        },
      });

      if (claimGuard.count === 0) {
        throw new BadRequestException('Reward already claimed');
      }

      const updated = await tx.battlePassProgress.findUnique({
        where: { id: progress.id },
        include: { season: true },
      });

      await tx.player.update({
        where: { id: player.id },
        data: {
          euros: { increment: reward.euros },
          vidaCoins: { increment: reward.vida },
        },
      });

      if (reward.euros > 0) {
        await tx.transactionLog.create({
          data: {
            playerId: player.id,
            type: 'EARN',
            amount: reward.euros,
            currency: 'EUR',
            reason: `Battle Pass level ${level} reward${effectivePremium ? ' (Premium)' : ''}`,
            reference: progress.seasonId,
          },
        });
      }

      if (reward.vida > 0) {
        await tx.transactionLog.create({
          data: {
            playerId: player.id,
            type: 'EARN',
            amount: reward.vida,
            currency: 'VIDACOIN',
            reason: `Battle Pass level ${level} reward (VidaCoins)`,
            reference: progress.seasonId,
          },
        });
      }

      return {
        progress: {
          ...(updated ?? progress),
          hasClubVip: progress.hasClubVip,
          effectivePremium,
          premiumPriceVida: BATTLE_PASS_PREMIUM_PRICE_VC,
          xpPerLevel: BATTLE_PASS_XP_PER_LEVEL,
        },
        reward,
        effectivePremium,
      };
    });
  }

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }
}
