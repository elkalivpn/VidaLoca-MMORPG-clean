import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BattlePassService } from './battle-pass.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsNumber, Min, Max } from 'class-validator';

class ClaimRewardDto {
  @IsNumber()
  @Min(1)
  @Max(100)
  level: number;
}

class AddXpDto {
  @IsNumber()
  @Min(1)
  amount: number;
}

@Controller('battle-pass')
@UseGuards(AuthGuard('jwt'))
export class BattlePassController {
  constructor(private battlePassService: BattlePassService) {}

  @Get('season')
  async getSeason() {
    return this.battlePassService.getActiveSeason();
  }

  @Get('my')
  async getMyProgress(@CurrentUser('id') userId: string) {
    return this.battlePassService.getPlayerProgress(userId);
  }

  @Post('xp')
  async addXp(
    @CurrentUser('id') userId: string,
    @Body() dto: AddXpDto,
  ) {
    return this.battlePassService.addXp(userId, dto.amount);
  }

  @Post('claim')
  async claim(
    @CurrentUser('id') userId: string,
    @Body() dto: ClaimRewardDto,
  ) {
    return this.battlePassService.claimReward(userId, dto.level);
  }
}
