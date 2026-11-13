import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class EconomyService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
  ) {}

  async addEuros(userId: string, amount: number, reason: string, reference?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.player.findUnique({ where: { userId } });
      if (!existing) {
        throw new BadRequestException('Player not found');
      }

      const player = await tx.player.update({
        where: { userId },
        data: { euros: { increment: amount } },
      });

      await this.transactionsService.logTransaction(tx, player.id, 'EARN', amount, 'EUR', reason, reference);

      return player;
    });
  }

  async spendEuros(userId: string, amount: number, reason: string, reference?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const res = await tx.player.updateMany({
        where: { userId, euros: { gte: amount } },
        data: { euros: { decrement: amount } },
      });

      if (res.count === 0) {
        throw new BadRequestException('Insufficient euros');
      }

      const updatedPlayer = await tx.player.findUnique({ where: { userId } });
      if (!updatedPlayer) {
        throw new BadRequestException('Player not found');
      }

      await this.transactionsService.logTransaction(tx, updatedPlayer.id, 'SPEND', amount, 'EUR', reason, reference);

      return updatedPlayer;
    });
  }

  async addVidaCoins(userId: string, amount: number, reason: string, reference?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.player.findUnique({ where: { userId } });
      if (!existing) {
        throw new BadRequestException('Player not found');
      }

      const player = await tx.player.update({
        where: { userId },
        data: { vidaCoins: { increment: amount } },
      });

      await this.transactionsService.logTransaction(tx, player.id, 'EARN', amount, 'VIDACOIN', reason, reference);

      return player;
    });
  }

  async spendVidaCoins(userId: string, amount: number, reason: string, reference?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const res = await tx.player.updateMany({
        where: { userId, vidaCoins: { gte: amount } },
        data: { vidaCoins: { decrement: amount } },
      });

      if (res.count === 0) {
        throw new BadRequestException('Insufficient VidaCoins');
      }

      const updatedPlayer = await tx.player.findUnique({ where: { userId } });
      if (!updatedPlayer) {
        throw new BadRequestException('Player not found');
      }

      await this.transactionsService.logTransaction(tx, updatedPlayer.id, 'SPEND', amount, 'VIDACOIN', reason, reference);

      return updatedPlayer;
    });
  }

  async getBalance(userId: string) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
      select: { euros: true, vidaCoins: true },
    });

    if (!player) {
      throw new BadRequestException('Player not found');
    }

    return { euros: player.euros, vidaCoins: player.vidaCoins };
  }

  async purchaseWithVidaCoins(userId: string, amount: number, item: string) {
    return this.spendVidaCoins(userId, amount, `Purchase: ${item}`, `purchase_${Date.now()}`);
  }

  async purchaseWithEuros(userId: string, amount: number, item: string) {
    return this.spendEuros(userId, amount, `Purchase: ${item}`, `purchase_${Date.now()}`);
  }
}
