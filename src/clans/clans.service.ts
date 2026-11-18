import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
        data: { name, tag, leaderId: player.id, funds: 0 },
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

  async transferLeadership(userId: string, targetPlayerId: string) {
    const player = await this.getPlayerOrThrow(userId);
    if (player.id === targetPlayerId) {
      throw new BadRequestException('Ya eres el líder del clan');
    }

    const leaderMember = await this.prisma.clanMember.findUnique({
      where: { playerId: player.id },
    });
    if (!leaderMember || leaderMember.role !== 'LEADER') {
      throw new ForbiddenException(
        'Solo el líder puede transferir el liderazgo',
      );
    }

    const targetMember = await this.prisma.clanMember.findUnique({
      where: { playerId: targetPlayerId },
      include: { player: { select: { displayName: true } } },
    });
    if (!targetMember || targetMember.clanId !== leaderMember.clanId) {
      throw new NotFoundException('Ese jugador no pertenece a tu clan');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.clanMember.update({
        where: { id: leaderMember.id },
        data: { role: 'OFFICER' },
      });
      await tx.clanMember.update({
        where: { id: targetMember.id },
        data: { role: 'LEADER' },
      });
      await tx.clan.update({
        where: { id: leaderMember.clanId },
        data: { leaderId: targetPlayerId },
      });
    });

    return {
      transferred: true,
      newLeaderPlayerId: targetPlayerId,
      newLeaderName: targetMember.player?.displayName ?? 'Miembro',
    };
  }

  async kickMember(userId: string, targetPlayerId: string) {
    const player = await this.getPlayerOrThrow(userId);
    if (player.id === targetPlayerId) {
      throw new BadRequestException('No puedes expulsarte a ti mismo');
    }

    const actorMember = await this.prisma.clanMember.findUnique({
      where: { playerId: player.id },
    });
    if (
      !actorMember ||
      (actorMember.role !== 'LEADER' && actorMember.role !== 'OFFICER')
    ) {
      throw new ForbiddenException(
        'Solo el líder u oficiales pueden expulsar miembros',
      );
    }

    const targetMember = await this.prisma.clanMember.findUnique({
      where: { playerId: targetPlayerId },
      include: { player: { select: { displayName: true } } },
    });
    if (!targetMember || targetMember.clanId !== actorMember.clanId) {
      throw new NotFoundException('Ese jugador no pertenece a tu clan');
    }
    if (targetMember.role === 'LEADER') {
      throw new ForbiddenException('No puedes expulsar al líder del clan');
    }
    if (actorMember.role === 'OFFICER' && targetMember.role === 'OFFICER') {
      throw new ForbiddenException(
        'Un oficial no puede expulsar a otro oficial',
      );
    }

    await this.prisma.clanMember.delete({ where: { id: targetMember.id } });
    return {
      kicked: true,
      targetPlayerId,
      targetName: targetMember.player?.displayName ?? 'Miembro',
    };
  }

  async disbandClan(userId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const member = await this.prisma.clanMember.findUnique({
      where: { playerId: player.id },
    });
    if (!member) throw new NotFoundException('Not in a clan');
    if (member.role !== 'LEADER') {
      throw new ForbiddenException('Solo el líder puede disolver el clan');
    }

    const clanId = member.clanId;
    await this.prisma.$transaction(async (tx) => {
      await tx.territory.updateMany({
        where: { controllerId: clanId },
        data: { controllerId: null },
      });
      await tx.clanTerritory.deleteMany({ where: { clanId } });
      await tx.clanMember.deleteMany({ where: { clanId } });
      await tx.clan.delete({ where: { id: clanId } });
    });

    return { disbanded: true, clanId };
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
      throw new BadRequestException(
        'Debes pertenecer a un clan para reclamar territorio',
      );
    }
    if (member.role !== 'LEADER' && member.role !== 'OFFICER') {
      throw new BadRequestException(
        'Solo líder u oficial puede reclamar territorio',
      );
    }

    const territory = await this.prisma.territory.findUnique({
      where: { id: territoryId },
    });
    if (!territory) throw new NotFoundException('Territorio no encontrado');

    // Cost: 5000 euros from clan funds (or allow if funds low for early game)
    const clan = await this.prisma.clan.findUnique({
      where: { id: member.clanId },
    });
    if (!clan) throw new NotFoundException('Clan no encontrado');

    if (territory.controllerId === clan.id) {
      throw new BadRequestException('Tu clan ya controla este territorio');
    }

    const existingControl = await this.prisma.clanTerritory.findUnique({
      where: { territoryId },
    });
    if (existingControl) {
      const shieldMs = 2 * 60 * 60 * 1000;
      const elapsed = Date.now() - existingControl.capturedAt.getTime();
      if (elapsed < shieldMs) {
        const minsLeft = Math.ceil((shieldMs - elapsed) / 60_000);
        throw new BadRequestException(
          `Territorio protegido tras conquista (${minsLeft} min restantes)`,
        );
      }
    }

    const cost = 2500;
    if (clan.funds < cost) {
      throw new BadRequestException(
        `El clan necesita al menos ${cost} € en fondos`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const debit = await tx.clan.updateMany({
        where: { id: clan.id, funds: { gte: cost } },
        data: {
          funds: { decrement: cost },
          level: { increment: territory.controllerId ? 0 : 1 },
          xp: { increment: 100 },
        },
      });

      if (debit.count === 0) {
        throw new BadRequestException(
          `El clan necesita al menos ${cost} € en fondos`,
        );
      }

      // Release previous control record if any
      await tx.clanTerritory.deleteMany({ where: { territoryId } });

      await tx.territory.update({
        where: { id: territoryId },
        data: { controllerId: clan.id },
      });

      await tx.clanTerritory.create({
        data: { clanId: clan.id, territoryId },
      });

      return tx.territory.findUnique({
        where: { id: territoryId },
        include: {
          controller: { select: { id: true, name: true, tag: true } },
        },
      });
    });
  }

  async donateToClan(userId: string, amount: number) {
    if (!Number.isFinite(amount) || amount < 50 || amount > 10_000_000) {
      throw new BadRequestException('Aporte válido entre 50 € y 10.000.000 €');
    }
    const cleanAmount = Math.round(amount * 100) / 100;
    const player = await this.getPlayerOrThrow(userId);
    const member = await this.prisma.clanMember.findUnique({
      where: { playerId: player.id },
    });
    if (!member) {
      throw new BadRequestException('No perteneces a ningún clan');
    }

    return this.prisma.$transaction(async (tx) => {
      const debit = await tx.player.updateMany({
        where: { id: player.id, euros: { gte: cleanAmount } },
        data: { euros: { decrement: cleanAmount } },
      });
      if (debit.count === 0) {
        throw new BadRequestException(
          'Saldo insuficiente para aportar al clan',
        );
      }

      const clan = await tx.clan.update({
        where: { id: member.clanId },
        data: { funds: { increment: cleanAmount } },
      });

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'SPEND',
          amount: cleanAmount,
          currency: 'EUR',
          reason: `Donación a fondos del clan [${clan.tag}]`,
          reference: clan.id,
        },
      });

      return { donated: cleanAmount, clanFunds: clan.funds };
    });
  }

  async collectTerritoryTax(userId: string, territoryId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const member = await this.prisma.clanMember.findUnique({
      where: { playerId: player.id },
    });
    if (!member || (member.role !== 'LEADER' && member.role !== 'OFFICER')) {
      throw new BadRequestException(
        'Solo líderes u oficiales pueden recaudar impuestos territoriales',
      );
    }

    const territory = await this.prisma.territory.findUnique({
      where: { id: territoryId },
    });
    if (!territory) throw new NotFoundException('Territorio no encontrado');
    if (territory.controllerId !== member.clanId) {
      throw new BadRequestException('Tu clan no controla este territorio');
    }

    const TAX_COOLDOWN_MS = 4 * 60 * 60 * 1000;
    const now = new Date();
    const cutoff = new Date(now.getTime() - TAX_COOLDOWN_MS);
    const taxAmount = Math.round(territory.incomeRate * 2 * 100) / 100;

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.territory.updateMany({
        where: {
          id: territoryId,
          controllerId: member.clanId,
          OR: [
            { lastTaxCollectedAt: null },
            { lastTaxCollectedAt: { lte: cutoff } },
          ],
        },
        data: { lastTaxCollectedAt: now },
      });

      if (claim.count === 0) {
        throw new BadRequestException(
          'Impuesto ya recaudado recientemente (cooldown de 4 horas).',
        );
      }

      const clan = await tx.clan.update({
        where: { id: member.clanId },
        data: {
          funds: { increment: taxAmount },
          xp: { increment: 50 },
        },
      });

      return {
        territoryName: territory.name,
        taxAmount,
        clanFunds: clan.funds,
      };
    });
  }

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }
}
