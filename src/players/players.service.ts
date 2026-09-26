import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  async getPlayerByUserId(userId: string) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
      include: {
        inventory: { include: { template: true } },
        vehicles: { include: { template: true } },
        properties: { include: { template: true } },
        weapons: true,
        clanMember: { include: { clan: true } },
        skills: { include: { skill: true } },
        battlePass: { include: { season: true } },
      },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    return player;
  }

  async updatePlayerLocation(userId: string, locationId: string) {
    return this.prisma.player.update({
      where: { userId },
      data: { locationId },
    });
  }

  async addXp(userId: string, xp: number) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const newXp = player.xp + xp;
    const newLevel = Math.floor(newXp / 1000) + 1;

    return this.prisma.player.update({
      where: { userId },
      data: {
        xp: newXp,
        level: newLevel > player.level ? newLevel : player.level,
      },
    });
  }

  async addReputation(userId: string, reputation: number) {
    return this.prisma.player.update({
      where: { userId },
      data: { reputation: { increment: reputation } },
    });
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    return this.prisma.player.updateMany({
      where: { userId },
      data: { isOnline, lastLogin: isOnline ? new Date() : undefined },
    });
  }

  async getAllPlayers(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [players, total] = await Promise.all([
      this.prisma.player.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { username: true, email: true } },
          clanMember: { include: { clan: { select: { name: true, tag: true } } } },
        },
        orderBy: { level: 'desc' },
      }),
      this.prisma.player.count(),
    ]);

    return { players, total, page, totalPages: Math.ceil(total / limit) };
  }
}
