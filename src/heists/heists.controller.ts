import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HeistsService } from './heists.service';
import { CreateHeistDto, JoinHeistDto } from './dto/heists.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('heists')
@UseGuards(AuthGuard('jwt'))
export class HeistsController {
  constructor(private readonly heistsService: HeistsService) {}

  @Get()
  getCatalogAndLobbies() {
    return this.heistsService.getCatalogAndLobbies();
  }

  @Post('create')
  createLobby(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateHeistDto,
  ) {
    return this.heistsService.createLobby(userId, dto);
  }

  @Post(':lobbyId/join')
  joinLobby(
    @CurrentUser('id') userId: string,
    @Param('lobbyId') lobbyId: string,
    @Body() dto: JoinHeistDto,
  ) {
    return this.heistsService.joinLobby(userId, lobbyId, dto);
  }

  @Post(':lobbyId/leave')
  leaveLobby(
    @CurrentUser('id') userId: string,
    @Param('lobbyId') lobbyId: string,
  ) {
    return this.heistsService.leaveLobby(userId, lobbyId);
  }

  @Post(':lobbyId/execute')
  executeLobby(
    @CurrentUser('id') userId: string,
    @Param('lobbyId') lobbyId: string,
  ) {
    return this.heistsService.executeLobby(userId, lobbyId);
  }
}
