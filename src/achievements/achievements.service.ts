import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AchievementsService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.achievement.findMany({
      orderBy: { rewardVida: 'desc' },
    });
  }

  async getPlayerAchievements(userId: string) {
    const player = await this.getPlayerOrThrow(userId);
    return this.prisma.playerAchievement.findMany({
      where: { playerId: player.id },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  async checkAndUnlock(userId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const allAchievements = await this.prisma.achievement.findMany();
    const unlocked = await this.prisma.playerAchievement.findMany({
      where: { playerId: player.id },
      select: { achievementId: true },
    });
    const unlockedIds = new Set(unlocked.map((u) => u.achievementId));

    const newlyUnlocked = [];

    for (const ach of allAchievements) {
      if (unlockedIds.has(ach.id)) continue;

      const condition = ach.condition as { type: string; value: number };
      let met = false;

      switch (condition?.type) {
        case 'reach_level':
          met = player.level >= condition.value;
          break;
        case 'earn_euros':
          met = player.euros >= condition.value;
          break;
        case 'reputation':
          met = player.reputation >= condition.value;
          break;
        default:
          break;
      }

      if (met) {
        const result = await this.prisma.$transaction(async (tx) => {
          const pa = await tx.playerAchievement.create({
            data: {
              playerId: player.id,
              achievementId: ach.id,
            },
            include: { achievement: true },
          });

          // Grant rewards
          await tx.player.update({
            where: { id: player.id },
            data: {
              vidaCoins: { increment: ach.rewardVida },
              euros: { increment: ach.rewardEuros },
            },
          });

          if (ach.rewardVida > 0) {
            await tx.transactionLog.create({
              data: {
                playerId: player.id,
                type: 'EARN',
                amount: ach.rewardVida,
                currency: 'VIDACOIN',
                reason: `Achievement: ${ach.name}`,
                reference: ach.id,
              },
            });
          }

          return pa;
        });

        newlyUnlocked.push(result);
      }
    }

    return newlyUnlocked;
  }

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }
}
