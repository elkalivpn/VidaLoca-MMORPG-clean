import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { AuthGuard } from '@nestjs/passport';
import { Currency } from '@prisma/client';

@Controller('transactions')
@UseGuards(AuthGuard('jwt'))
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  async getTransactions(
    @Req() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.transactionsService.getPlayerTransactions(req.user.id, parseInt(page), parseInt(limit));
  }

  @Get('history')
  async getHistory(@Req() req, @Query('currency') currency?: Currency) {
    return this.transactionsService.getTransactionHistory(req.user.id, currency);
  }
}
