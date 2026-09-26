import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('economy')
@UseGuards(AuthGuard('jwt'))
export class EconomyController {
  constructor(private economyService: EconomyService) {}

  @Get('balance')
  async getBalance(@Req() req) {
    return this.economyService.getBalance(req.user.id);
  }

  @Post('euros/add')
  async addEuros(@Req() req, @Body('amount') amount: number, @Body('reason') reason: string) {
    return this.economyService.addEuros(req.user.id, amount, reason);
  }

  @Post('euros/spend')
  async spendEuros(@Req() req, @Body('amount') amount: number, @Body('reason') reason: string) {
    return this.economyService.spendEuros(req.user.id, amount, reason);
  }

  @Post('vidacoins/add')
  async addVidaCoins(@Req() req, @Body('amount') amount: number, @Body('reason') reason: string) {
    return this.economyService.addVidaCoins(req.user.id, amount, reason);
  }

  @Post('vidacoins/spend')
  async spendVidaCoins(@Req() req, @Body('amount') amount: number, @Body('reason') reason: string) {
    return this.economyService.spendVidaCoins(req.user.id, amount, reason);
  }

  @Post('purchase/vida')
  async purchaseWithVidaCoins(@Req() req, @Body('amount') amount: number, @Body('item') item: string) {
    return this.economyService.purchaseWithVidaCoins(req.user.id, amount, item);
  }

  @Post('purchase/euros')
  async purchaseWithEuros(@Req() req, @Body('amount') amount: number, @Body('item') item: string) {
    return this.economyService.purchaseWithEuros(req.user.id, amount, item);
  }
}
