import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WorldService } from './world.service';

@Controller('world')
@UseGuards(AuthGuard('jwt'))
export class WorldController {
  constructor(private world: WorldService) {}

  @Get('street')
  street(@Req() req: any) {
    return this.world.getStreetState(req.user.id);
  }

  @Post('action')
  action(@Req() req: any, @Body('actionId') actionId: string) {
    return this.world.performAction(req.user.id, actionId);
  }

  @Post('lifestyle')
  lifestyle(
    @Req() req: any,
    @Body('lifestyle') lifestyle: 'LEGAL' | 'GREY' | 'STREET',
  ) {
    return this.world.setLifestyle(req.user.id, lifestyle);
  }
}
