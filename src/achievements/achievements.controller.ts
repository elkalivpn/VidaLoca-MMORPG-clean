import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AchievementsService } from './achievements.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('achievements')
@UseGuards(AuthGuard('jwt'))
export class AchievementsController {
  constructor(private achievementsService: AchievementsService) {}

  @Get()
  async getAll() {
    return this.achievementsService.getAll();
  }

  @Get('my')
  async getMy(@CurrentUser('id') userId: string) {
    return this.achievementsService.getPlayerAchievements(userId);
  }

  @Post('check')
  async check(@CurrentUser('id') userId: string) {
    return this.achievementsService.checkAndUnlock(userId);
  }
}
