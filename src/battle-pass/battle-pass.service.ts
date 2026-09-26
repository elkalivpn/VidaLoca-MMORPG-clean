import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    }

    return progress;
  }

  async addXp(userId: string, amount: number) {
    const player = await this.getPlayerOrThrow(userId);
    const progress = await this.getPlayerProgress(userId);

    const newXp = progress.xp + amount;
    // 200 XP per battle pass level
    const xpPerLevel = 200;
    let newLevel = progress.level;
    let remaining = newXp;

    while (remaining >= xpPerLevel && newLevel < 100) {
      remaining -= xpPerLevel;
      newLevel += 1;
    }

    return this.prisma.battlePassProgress.update({
      where: { id: progress.id },
      data: {
        xp: remaining,
        level: newLevel,
      },
      include: { season: true },
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

    // Simple reward table
    const freeReward = { euros: level * 50, vida: 0 };
    const premiumReward = { euros: level * 100, vida: level * 5 };

    const reward = progress.isPremium ? premiumReward : freeReward;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.battlePassProgress.update({
        where: { id: progress.id },
        data: {
          rewardsClaimed: { push: level },
        },
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
            reason: `Battle Pass level ${level} reward`,
            reference: progress.seasonId,
          },
        });
      }

      return { progress: updated, reward };
    });
  }

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }
}
