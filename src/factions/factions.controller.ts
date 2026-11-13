import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FactionsService } from './factions.service';
import { InterceptDto, JoinFactionDto } from './dto/factions.dto';

@ApiTags('factions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('factions')
export class FactionsController {
  constructor(private readonly factionsService: FactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Catálogo de facciones con perks y miembros activos' })
  getCatalog() {
    return this.factionsService.getCatalog();
  }

  @Post('join')
  @ApiOperation({ summary: 'Unirse o cambiar de facción' })
  joinFaction(@Req() req: any, @Body() dto: JoinFactionDto) {
    return this.factionsService.joinFaction(req.user.id, dto.faction);
  }

  @Get('wanted')
  @ApiOperation({ summary: 'Lista de jugadores buscados (heat >= 40)' })
  getWantedPlayers() {
    return this.factionsService.getWantedPlayers();
  }

  @Post('intercept')
  @ApiOperation({ summary: 'Interceptar a un sospechoso en la misma zona' })
  interceptSuspect(@Req() req: any, @Body() dto: InterceptDto) {
    return this.factionsService.interceptSuspect(
      req.user.id,
      dto.suspectPlayerId,
    );
  }

  @Post('bail')
  @ApiOperation({ summary: 'Pagar fianza para salir del calabozo' })
  payBail(@Req() req: any) {
    return this.factionsService.payBail(req.user.id);
  }
}
