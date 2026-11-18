import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CasinoService } from './casino.service';
import {
  BlackjackActionDto,
  BlackjackStartDto,
  DiceBetDto,
  RouletteBetDto,
} from './dto/casino.dto';

@Controller('casino')
@UseGuards(AuthGuard('jwt'))
export class CasinoController {
  constructor(private readonly casinoService: CasinoService) {}

  @Get('status')
  getStatus(@Req() req: { user: { id: string } }) {
    return this.casinoService.getStatus(req.user.id);
  }

  @Post('roulette')
  playRoulette(
    @Req() req: { user: { id: string } },
    @Body() dto: RouletteBetDto,
  ) {
    return this.casinoService.playRoulette(req.user.id, dto);
  }

  @Post('dice')
  playDice(@Req() req: { user: { id: string } }, @Body() dto: DiceBetDto) {
    return this.casinoService.playDice(req.user.id, dto);
  }

  @Post('blackjack/start')
  startBlackjack(
    @Req() req: { user: { id: string } },
    @Body() dto: BlackjackStartDto,
  ) {
    return this.casinoService.startBlackjack(req.user.id, dto);
  }

  @Post('blackjack/action')
  blackjackAction(
    @Req() req: { user: { id: string } },
    @Body() dto: BlackjackActionDto,
  ) {
    return this.casinoService.blackjackAction(req.user.id, dto);
  }
}
