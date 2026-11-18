import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { WorldService } from './world.service';
import { TravelDto } from './dto/travel.dto';
import { MarketTradeDto } from './dto/market-trade.dto';
import { StreetCombatDto } from './dto/street-combat.dto';

class PerformActionDto {
  @IsString()
  @IsNotEmpty()
  actionId: string;
}

class SetLifestyleDto {
  @IsIn(['LEGAL', 'GREY', 'STREET'])
  lifestyle: 'LEGAL' | 'GREY' | 'STREET';
}

@Controller('world')
@UseGuards(AuthGuard('jwt'))
export class WorldController {
  constructor(private world: WorldService) {}

  @Get('street')
  street(@Req() req: any) {
    return this.world.getStreetState(req.user.id);
  }

  @Get('map')
  map() {
    return this.world.getMapState();
  }

  @Post('travel')
  travel(@Req() req: any, @Body() dto: TravelDto) {
    return this.world.travel(req.user.id, dto.destinationId);
  }

  @Post('action')
  action(@Req() req: any, @Body() dto: PerformActionDto) {
    return this.world.performAction(req.user.id, dto.actionId);
  }

  @Post('lifestyle')
  lifestyle(@Req() req: any, @Body() dto: SetLifestyleDto) {
    return this.world.setLifestyle(req.user.id, dto.lifestyle);
  }

  @Get('market')
  market(@Req() req: any) {
    return this.world.getMarket(req.user.id);
  }

  @Post('market/trade')
  tradeMarket(@Req() req: any, @Body() dto: MarketTradeDto) {
    return this.world.tradeMarket(req.user.id, dto);
  }

  @Post('combat')
  combat(@Req() req: { user: { id: string } }, @Body() dto: StreetCombatDto) {
    return this.world.streetCombat(req.user.id, dto);
  }
}
