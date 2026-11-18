import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isValidZoneId, ZONES_BY_ID } from '../common/constants/zones';
import { calculateLevelFromXp } from '../common/utils/level.util';
import { AchievementsService } from '../achievements/achievements.service';

@Injectable()
export class PlayersService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly achievementsService?: AchievementsService,
  ) {}

  async getPlayerByUserId(userId: string) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
      include: {
        user: { select: { username: true, isGuest: true } },
        inventory: {
          include: { template: true },
          orderBy: [{ equipped: 'desc' }, { acquiredAt: 'desc' }],
        },
        vehicles: {
          include: { template: true },
          orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
        },
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
    if (!isValidZoneId(locationId)) {
      throw new BadRequestException('Invalid locationId');
    }

    const player = await this.prisma.player.findUnique({
      where: { userId },
    });
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    if (player.jailUntil && new Date(player.jailUntil).getTime() > Date.now()) {
      throw new ForbiddenException(
        'No puedes cambiar de zona mientras estás en el calabozo',
      );
    }

    const currentZoneId = player.locationId || 'madrid_centro';
    const currentCity = ZONES_BY_ID[currentZoneId]?.city;
    const nextCity = ZONES_BY_ID[locationId]?.city;

    if (currentCity && nextCity && currentCity !== nextCity) {
      throw new BadRequestException(
        'El viaje entre ciudades requiere usar la red de transporte (/world/travel).',
      );
    }

    return this.prisma.player.update({
      where: { userId },
      data: { locationId },
    });
  }

  async addXp(userId: string, xp: number, targetPlayerId?: string) {
    const player = targetPlayerId
      ? await this.prisma.player.findUnique({ where: { id: targetPlayerId } })
      : await this.prisma.player.findUnique({ where: { userId } });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const newXp = player.xp + xp;
    const newLevel = calculateLevelFromXp(newXp);

    const updated = await this.prisma.player.update({
      where: { id: player.id },
      data: {
        xp: newXp,
        level: newLevel > player.level ? newLevel : player.level,
      },
    });

    await this.achievementsService
      ?.checkAndUnlock(player.userId)
      .catch(() => undefined);

    return updated;
  }

  async addReputation(
    userId: string,
    reputation: number,
    targetPlayerId?: string,
  ) {
    const player = targetPlayerId
      ? await this.prisma.player.findUnique({ where: { id: targetPlayerId } })
      : await this.prisma.player.findUnique({ where: { userId } });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const updated = await this.prisma.player.update({
      where: { id: player.id },
      data: { reputation: { increment: reputation } },
    });

    await this.achievementsService
      ?.checkAndUnlock(player.userId)
      .catch(() => undefined);

    return updated;
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
          user: { select: { username: true } },
          clanMember: {
            include: { clan: { select: { name: true, tag: true } } },
          },
        },
        orderBy: { level: 'desc' },
      }),
      this.prisma.player.count(),
    ]);

    return { players, total, page, totalPages: Math.ceil(total / limit) };
  }
}
