import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarketListingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BanPlayerDto, GrantVipDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const [
      totalUsers,
      guestUsers,
      totalPlayers,
      activeVipPlayers,
      activeListings,
      totalClans,
      economyAgg,
      recentPlayers,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isGuest: true } }),
      this.prisma.player.count(),
      this.prisma.player.count({
        where: {
          isVip: true,
          OR: [{ vipExpiresAt: null }, { vipExpiresAt: { gt: now } }],
        },
      }),
      this.prisma.marketListing.count({
        where: { status: MarketListingStatus.ACTIVE },
      }),
      this.prisma.clan.count(),
      this.prisma.player.aggregate({
        _sum: { euros: true, vidaCoins: true },
      }),
      this.prisma.player.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          displayName: true,
          level: true,
          euros: true,
          vidaCoins: true,
          isVip: true,
          vipExpiresAt: true,
          user: {
            select: {
              username: true,
              email: true,
              role: true,
              isGuest: true,
              isBanned: true,
              banReason: true,
            },
          },
        },
      }),
      this.prisma.securityAuditLog.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          actorId: true,
          eventType: true,
          severity: true,
          target: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      metrics: {
        totalUsers,
        guestUsers,
        totalPlayers,
        activeVipPlayers,
        activeListings,
        totalClans,
        totalEurosInEconomy: Math.round(economyAgg._sum.euros ?? 0),
        totalVidaCoinsInEconomy: economyAgg._sum.vidaCoins ?? 0,
      },
      recentPlayers,
      recentAuditLogs,
    };
  }

  async setBanStatus(playerId: string, dto: BanPlayerDto) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, userId: true, displayName: true },
    });
    if (!player) throw new NotFoundException('Player not found');

    const updatedUser = await this.prisma.user.update({
      where: { id: player.userId },
      data: {
        isBanned: dto.isBanned,
        banReason: dto.isBanned
          ? (dto.reason ?? 'Moderación administrativa')
          : null,
        tokenVersion: { increment: 1 },
      },
      select: {
        id: true,
        username: true,
        isBanned: true,
        banReason: true,
      },
    });

    return {
      playerId: player.id,
      displayName: player.displayName,
      user: updatedUser,
    };
  }

  async grantVipAndCoins(playerId: string, dto: GrantVipDto) {
    const days = dto.days ?? 0;
    const vidaCoins = dto.vidaCoins ?? 0;
    if (days <= 0 && vidaCoins <= 0) {
      throw new BadRequestException(
        'Debes indicar días VIP o cantidad de VidaCoins a otorgar',
      );
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!player) throw new NotFoundException('Player not found');

    const now = new Date();
    const baseTime =
      player.isVip && player.vipExpiresAt && player.vipExpiresAt > now
        ? player.vipExpiresAt.getTime()
        : now.getTime();
    const nextVipExpiresAt =
      days > 0 ? new Date(baseTime + days * 86_400_000) : player.vipExpiresAt;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          ...(days > 0 ? { isVip: true, vipExpiresAt: nextVipExpiresAt } : {}),
          ...(vidaCoins > 0 ? { vidaCoins: { increment: vidaCoins } } : {}),
        },
        select: {
          id: true,
          displayName: true,
          isVip: true,
          vipExpiresAt: true,
          vidaCoins: true,
        },
      });

      if (vidaCoins > 0) {
        await tx.transactionLog.create({
          data: {
            playerId: player.id,
            type: 'GIFT',
            amount: vidaCoins,
            currency: 'VIDACOIN',
            reason: dto.reason ?? `Soporte Admin (+${vidaCoins} VC)`,
          },
        });
      }

      return {
        player: updated,
        grantedDays: days,
        grantedVidaCoins: vidaCoins,
      };
    });
  }
}
