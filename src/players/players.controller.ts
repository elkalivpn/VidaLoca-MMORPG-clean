import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PlayersService } from './players.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

class UpdateLocationDto {
  @IsString()
  @IsNotEmpty()
  locationId: string;
}

class AddXpDto {
  @IsNumber()
  @Min(1)
  xp: number;
}

class AddReputationDto {
  @IsNumber()
  reputation: number;
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
  async getAllPlayers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.playersService.getAllPlayers(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post('location')
  async updateLocation(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.playersService.updatePlayerLocation(userId, dto.locationId);
  }

  @Post('xp')
  async addXp(
    @CurrentUser('id') userId: string,
    @Body() dto: AddXpDto,
  ) {
    return this.playersService.addXp(userId, dto.xp);
  }

  @Post('reputation')
  async addReputation(
    @CurrentUser('id') userId: string,
    @Body() dto: AddReputationDto,
  ) {
    return this.playersService.addReputation(userId, dto.reputation);
  }
}
