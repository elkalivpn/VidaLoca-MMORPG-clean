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
      const player = await tx.player.update({
        where: { userId },
        data: { euros: { increment: amount } },
      });

      await this.transactionsService.logTransaction(tx, userId, 'EARN', amount, 'EUR', reason, reference);

      return player;
    });
  }

  async spendEuros(userId: string, amount: number, reason: string, reference?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { userId } });

      if (!player || player.euros < amount) {
        throw new BadRequestException('Insufficient euros');
      }

      const updatedPlayer = await tx.player.update({
        where: { userId },
        data: { euros: { decrement: amount } },
      });

      await this.transactionsService.logTransaction(tx, userId, 'SPEND', amount, 'EUR', reason, reference);

      return updatedPlayer;
    });
  }

  async addVidaCoins(userId: string, amount: number, reason: string, reference?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.update({
        where: { userId },
        data: { vidaCoins: { increment: amount } },
      });

      await this.transactionsService.logTransaction(tx, userId, 'EARN', amount, 'VIDACOIN', reason, reference);

      return player;
    });
  }

  async spendVidaCoins(userId: string, amount: number, reason: string, reference?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { userId } });

      if (!player || player.vidaCoins < amount) {
        throw new BadRequestException('Insufficient VidaCoins');
      }

      const updatedPlayer = await tx.player.update({
        where: { userId },
        data: { vidaCoins: { decrement: amount } },
      });

      await this.transactionsService.logTransaction(tx, userId, 'SPEND', amount, 'VIDACOIN', reason, reference);

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
