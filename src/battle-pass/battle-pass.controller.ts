import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { BattlePassService } from './battle-pass.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
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
  @Max(5000)
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
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
