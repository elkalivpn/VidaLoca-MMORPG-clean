import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { AuthGuard } from '@nestjs/passport';
import { Currency } from '@prisma/client';
import type { AuthenticatedRequest } from '../common/types/auth-request.type';

@Controller('transactions')
@UseGuards(AuthGuard('jwt'))
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  async getTransactions(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(
      100,
      Math.max(1, Number.parseInt(limit, 10) || 20),
    );
    return this.transactionsService.getPlayerTransactions(
      req.user.id,
      safePage,
      safeLimit,
    );
  }

  @Get('history')
  async getHistory(
    @Req() req: AuthenticatedRequest,
    @Query('currency') currency?: Currency,
  ) {
    return this.transactionsService.getTransactionHistory(
      req.user.id,
      currency,
    );
  }
}
