import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ClansService } from './clans.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('clans')
@UseGuards(AuthGuard('jwt'))
export class ClansController {
  constructor(private clansService: ClansService) {}

  @Post('create')
  async createClan(
    @Req() req: any,
    @Body('name') name: string,
    @Body('tag') tag: string,
  ) {
    return this.clansService.createClan(req.user.id, name, tag);
  }

  @Get('my')
  async getMyClan(@Req() req: any) {
    return this.clansService.getClanByUserId(req.user.id);
  }

  /** Fixed: clanId comes from route param, not body */
  @Post('join/:clanId')
  async joinClan(@Req() req: any, @Param('clanId') clanId: string) {
    return this.clansService.joinClan(req.user.id, clanId);
  }

  @Post('leave')
  async leaveClan(@Req() req: any) {
    return this.clansService.leaveClan(req.user.id);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    return this.clansService.getClanLeaderboard();
  }

  @Get('territories')
  async listTerritories() {
    return this.clansService.listTerritories();
  }

  @Post('territories/:territoryId/claim')
  async claimTerritory(
    @Req() req: any,
    @Param('territoryId') territoryId: string,
  ) {
    return this.clansService.claimTerritory(req.user.id, territoryId);
  }
}

