import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';
import { EconomyService } from './economy.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class AmountReasonDto {
  @IsNumber()
  @Min(0.01)
  @Max(100_000_000)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  reason: string;
}

class PurchaseItemDto {
  @IsNumber()
  @Min(0.01)
  @Max(100_000_000)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  item: string;
}

@Controller('economy')
@UseGuards(AuthGuard('jwt'))
export class EconomyController {
  constructor(private economyService: EconomyService) {}

  @Get('balance')
  async getBalance(@Req() req: { user: { id: string } }) {
    return this.economyService.getBalance(req.user.id);
  }

  @Post('euros/add')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async addEuros(@Req() req: { user: { id: string } }, @Body() dto: AmountReasonDto) {
    return this.economyService.addEuros(req.user.id, dto.amount, dto.reason);
  }

  @Post('euros/spend')
  async spendEuros(@Req() req: { user: { id: string } }, @Body() dto: AmountReasonDto) {
    return this.economyService.spendEuros(req.user.id, dto.amount, dto.reason);
  }

  @Post('vidacoins/add')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async addVidaCoins(@Req() req: { user: { id: string } }, @Body() dto: AmountReasonDto) {
    return this.economyService.addVidaCoins(req.user.id, dto.amount, dto.reason);
  }

  @Post('vidacoins/spend')
  async spendVidaCoins(@Req() req: { user: { id: string } }, @Body() dto: AmountReasonDto) {
    return this.economyService.spendVidaCoins(req.user.id, dto.amount, dto.reason);
  }

  @Post('purchase/vida')
  async purchaseWithVidaCoins(@Req() req: { user: { id: string } }, @Body() dto: PurchaseItemDto) {
    return this.economyService.purchaseWithVidaCoins(req.user.id, dto.amount, dto.item);
  }

  @Post('purchase/euros')
  async purchaseWithEuros(@Req() req: { user: { id: string } }, @Body() dto: PurchaseItemDto) {
    return this.economyService.purchaseWithEuros(req.user.id, dto.amount, dto.item);
  }
}
