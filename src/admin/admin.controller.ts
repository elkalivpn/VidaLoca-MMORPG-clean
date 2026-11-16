import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { BanPlayerDto, GrantVipDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('overview')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getOverview() {
    return this.adminService.getOverview();
  }

  @Post('players/:playerId/ban')
  @Roles(UserRole.ADMIN)
  async setBanStatus(
    @Param('playerId') playerId: string,
    @Body() dto: BanPlayerDto,
  ) {
    return this.adminService.setBanStatus(playerId, dto);
  }

  @Post('players/:playerId/grant-vip')
  @Roles(UserRole.ADMIN)
  async grantVip(
    @Param('playerId') playerId: string,
    @Body() dto: GrantVipDto,
  ) {
    return this.adminService.grantVipAndCoins(playerId, dto);
  }
}
