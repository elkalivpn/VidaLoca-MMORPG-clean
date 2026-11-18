import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { PlayersService } from './players.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

class UpdateLocationDto {
  @IsString()
  @IsNotEmpty()
  locationId: string;
}

class AddXpDto {
  @IsNumber()
  @Min(1)
  xp: number;

  @IsOptional()
  @IsString()
  targetPlayerId?: string;
}

class AddReputationDto {
  @IsNumber()
  reputation: number;

  @IsOptional()
  @IsString()
  targetPlayerId?: string;
}

@Controller('players')
@UseGuards(AuthGuard('jwt'))
export class PlayersController {
  constructor(private playersService: PlayersService) {}

  @Get('me')
  async getMyPlayer(@CurrentUser('id') userId: string) {
    return this.playersService.getPlayerByUserId(userId);
  }

  @Get()
  async getAllPlayers(@Query('page') page = '1', @Query('limit') limit = '20') {
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(
      100,
      Math.max(1, Number.parseInt(limit, 10) || 20),
    );
    return this.playersService.getAllPlayers(safePage, safeLimit);
  }

  @Post('location')
  async updateLocation(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.playersService.updatePlayerLocation(userId, dto.locationId);
  }

  @Post('xp')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async addXp(@CurrentUser('id') userId: string, @Body() dto: AddXpDto) {
    return this.playersService.addXp(userId, dto.xp, dto.targetPlayerId);
  }

  @Post('reputation')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async addReputation(
    @CurrentUser('id') userId: string,
    @Body() dto: AddReputationDto,
  ) {
    return this.playersService.addReputation(
      userId,
      dto.reputation,
      dto.targetPlayerId,
    );
  }
}
