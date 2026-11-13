import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { WorldService } from './world.service';

class PerformActionDto {
  @IsString()
  @IsNotEmpty()
  actionId: string;
}

class SetLifestyleDto {
  @IsIn(['LEGAL', 'GREY', 'STREET'])
  lifestyle: 'LEGAL' | 'GREY' | 'STREET';
}

@Controller('world')
@UseGuards(AuthGuard('jwt'))
export class WorldController {
  constructor(private world: WorldService) {}

  @Get('street')
  street(@Req() req: any) {
    return this.world.getStreetState(req.user.id);
  }

  @Post('action')
  action(@Req() req: any, @Body() dto: PerformActionDto) {
    return this.world.performAction(req.user.id, dto.actionId);
  }

  @Post('lifestyle')
  lifestyle(@Req() req: any, @Body() dto: SetLifestyleDto) {
    return this.world.setLifestyle(req.user.id, dto.lifestyle);
  }
}
