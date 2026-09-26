import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClansService {
  constructor(private prisma: PrismaService) {}

  async createClan(userId: string, name: string, tag: string) {
    const player = await this.getPlayerOrThrow(userId);

    const existingMember = await this.prisma.clanMember.findUnique({
      where: { playerId: player.id },
    });
    if (existingMember) {
      throw new BadRequestException('You are already in a clan');
    }

    const existingClan = await this.prisma.clan.findFirst({
      where: { OR: [{ name }, { tag }] },
    });
    if (existingClan) {
      throw new BadRequestException('Clan name or tag already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const clan = await tx.clan.create({
        data: { name, tag, leaderId: player.id, funds: 5000 },
      });

      await tx.clanMember.create({
        data: { playerId: player.id, clanId: clan.id, role: 'LEADER' },
      });

      return clan;
    });
  }

  async getClanByUserId(userId: string) {
    const player = await this.getPlayerOrThrow(userId);

    const member = await this.prisma.clanMember.findUnique({
      where: { playerId: player.id },
      include: {
        clan: {
          include: {
            members: {
              include: {
                player: {
                  include: { user: { select: { username: true } } },
                },
              },
            },
            territories: true,
            controlledTerritories: true,
          },
        },
      },
    });

    return member?.clan || null;
  }

  async joinClan(userId: string, clanId: string) {
    const player = await this.getPlayerOrThrow(userId);

    const existingMember = await this.prisma.clanMember.findUnique({
      where: { playerId: player.id },
    });
    if (existingMember) {
      throw new BadRequestException('Already in a clan');
    }

    const clan = await this.prisma.clan.findUnique({ where: { id: clanId } });
    if (!clan) throw new NotFoundException('Clan not found');

    return this.prisma.clanMember.create({
      data: { playerId: player.id, clanId, role: 'RECRUIT' },
    });
  }

  async leaveClan(userId: string) {
    const player = await this.getPlayerOrThrow(userId);

    const member = await this.prisma.clanMember.findUnique({
      where: { playerId: player.id },
    });
    if (!member) throw new NotFoundException('Not in a clan');
    if (member.role === 'LEADER') {
      throw new BadRequestException(
        'Leader must transfer leadership or disband the clan first',
      );
    }

    return this.prisma.clanMember.delete({ where: { id: member.id } });
  }

  async getClanLeaderboard(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [clans, total] = await Promise.all([
      this.prisma.clan.findMany({
        skip,
        take: limit,
        include: {
          members: { include: { player: true } },
          territories: true,
          controlledTerritories: true,
        },
        orderBy: { level: 'desc' },
      }),
      this.prisma.clan.count(),
    ]);

    return {
      clans,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }


  async listTerritories() {
    return this.prisma.territory.findMany({
      include: {
        controller: { select: { id: true, name: true, tag: true } },
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    });
  }

  async claimTerritory(userId: string, territoryId: string) {
    const player = await this.getPlayerOrThrow(userId);

    const member = await this.prisma.clanMember.findUnique({
      where: { playerId: player.id },
    });
    if (!member) {
      throw new BadRequestException('Debes pertenecer a un clan para reclamar territorio');
    }
    if (member.role !== 'LEADER' && member.role !== 'OFFICER') {
      throw new BadRequestException('Solo líder u oficial puede reclamar territorio');
    }

    const territory = await this.prisma.territory.findUnique({
      where: { id: territoryId },
    });
    if (!territory) throw new NotFoundException('Territorio no encontrado');

    // Cost: 5000 euros from clan funds (or allow if funds low for early game)
    const clan = await this.prisma.clan.findUnique({ where: { id: member.clanId } });
    if (!clan) throw new NotFoundException('Clan no encontrado');

    const cost = 2500;
    if (clan.funds < cost) {
      throw new BadRequestException(`El clan necesita al menos ${cost} € en fondos`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Release previous control record if any
      await tx.clanTerritory.deleteMany({ where: { territoryId } });

      await tx.territory.update({
        where: { id: territoryId },
        data: { controllerId: clan.id },
      });

      await tx.clanTerritory.create({
        data: { clanId: clan.id, territoryId },
      });

      await tx.clan.update({
        where: { id: clan.id },
        data: {
          funds: { decrement: cost },
          level: { increment: territory.controllerId ? 0 : 1 },
        },
      });

      return tx.territory.findUnique({
        where: { id: territoryId },
        include: {
          controller: { select: { id: true, name: true, tag: true } },
        },
      });
    });
  }

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }
}
