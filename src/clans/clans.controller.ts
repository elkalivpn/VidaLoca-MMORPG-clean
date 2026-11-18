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
import {
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { AuthenticatedRequest } from '../common/types/auth-request.type';

class CreateClanDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  name: string;

  @IsString()
  @Matches(/^[A-Za-z0-9]{2,6}$/, {
    message: 'El tag debe tener entre 2 y 6 caracteres alfanuméricos',
  })
  tag: string;
}

class DonateClanDto {
  @IsNumber()
  @Min(50)
  @Max(10_000_000)
  amount: number;
}

class TransferLeadershipDto {
  @IsString()
  @MinLength(1)
  targetPlayerId: string;
}

@Controller('clans')
@UseGuards(AuthGuard('jwt'))
export class ClansController {
  constructor(private clansService: ClansService) {}

  @Post('create')
  async createClan(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateClanDto,
  ) {
    return this.clansService.createClan(
      req.user.id,
      dto.name.trim(),
      dto.tag.trim().toUpperCase(),
    );
  }

  @Get('my')
  async getMyClan(@Req() req: AuthenticatedRequest) {
    return this.clansService.getClanByUserId(req.user.id);
  }

  /** Fixed: clanId comes from route param, not body */
  @Post('join/:clanId')
  async joinClan(
    @Req() req: AuthenticatedRequest,
    @Param('clanId') clanId: string,
  ) {
    return this.clansService.joinClan(req.user.id, clanId);
  }

  @Post('leave')
  async leaveClan(@Req() req: AuthenticatedRequest) {
    return this.clansService.leaveClan(req.user.id);
  }

  @Post('transfer')
  async transferLeadership(
    @Req() req: AuthenticatedRequest,
    @Body() dto: TransferLeadershipDto,
  ) {
    return this.clansService.transferLeadership(
      req.user.id,
      dto.targetPlayerId,
    );
  }

  @Post('kick/:targetPlayerId')
  async kickMember(
    @Req() req: AuthenticatedRequest,
    @Param('targetPlayerId') targetPlayerId: string,
  ) {
    return this.clansService.kickMember(req.user.id, targetPlayerId);
  }

  @Post('disband')
  async disbandClan(@Req() req: AuthenticatedRequest) {
    return this.clansService.disbandClan(req.user.id);
  }

  @Post('donate')
  async donateToClan(
    @Req() req: AuthenticatedRequest,
    @Body() dto: DonateClanDto,
  ) {
    return this.clansService.donateToClan(req.user.id, dto.amount);
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
    @Req() req: AuthenticatedRequest,
    @Param('territoryId') territoryId: string,
  ) {
    return this.clansService.claimTerritory(req.user.id, territoryId);
  }

  @Post('territories/:territoryId/collect')
  async collectTerritoryTax(
    @Req() req: AuthenticatedRequest,
    @Param('territoryId') territoryId: string,
  ) {
    return this.clansService.collectTerritoryTax(req.user.id, territoryId);
  }
}
