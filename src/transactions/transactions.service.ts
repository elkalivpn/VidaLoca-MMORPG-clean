import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType, Currency } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async logTransaction(
    tx: any,
    playerId: string,
    type: TransactionType,
    amount: number,
    currency: Currency,
    reason: string,
    reference?: string,
  ) {
    return tx.transactionLog.create({
      data: {
        playerId,
        type,
        amount,
        currency,
        reason,
        reference,
      },
    });
  }

  async getPlayerTransactions(userId: string, page: number = 1, limit: number = 20) {
    const player = await this.prisma.player.findUnique({ where: { userId } });

    if (!player) {
      throw new Error('Player not found');
    }

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      this.prisma.transactionLog.findMany({
        where: { playerId: player.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transactionLog.count({ where: { playerId: player.id } }),
    ]);

    return { transactions, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getTransactionHistory(userId: string, currency?: Currency) {
    const player = await this.prisma.player.findUnique({ where: { userId } });

    if (!player) {
      throw new Error('Player not found');
    }

    const where: any = { playerId: player.id };
    if (currency) {
      where.currency = currency;
    }

    return this.prisma.transactionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
