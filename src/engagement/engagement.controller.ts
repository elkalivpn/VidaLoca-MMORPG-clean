import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EngagementService } from './engagement.service';
import { ClaimChallengeDto } from './dto/engagement.dto';

@Controller('engagement')
export class EngagementController {
  constructor(private engagementService: EngagementService) {}

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  async getStatus(@CurrentUser('id') userId: string) {
    return this.engagementService.getStatus(userId);
  }

  @Post('daily-claim')
  @UseGuards(AuthGuard('jwt'))
  async claimDaily(@CurrentUser('id') userId: string) {
    return this.engagementService.claimDaily(userId);
  }

  @Post('daily-challenges/claim')
  @UseGuards(AuthGuard('jwt'))
  async claimChallenge(
    @CurrentUser('id') userId: string,
    @Body() dto: ClaimChallengeDto,
  ) {
    return this.engagementService.claimChallenge(userId, dto.challengeId);
  }

  @Get('leaderboards')
  async getLeaderboards() {
    return this.engagementService.getLeaderboards();
  }

  @Get('world-event')
  @UseGuards(AuthGuard('jwt'))
  async getWorldEvent(@CurrentUser('id') userId: string) {
    return this.engagementService.getWorldEventStatus(userId);
  }

  @Post('world-event/participate')
  @UseGuards(AuthGuard('jwt'))
  async participateWorldEvent(@CurrentUser('id') userId: string) {
    return this.engagementService.participateInWorldEvent(userId);
  }
}
