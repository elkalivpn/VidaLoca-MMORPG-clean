import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { VehiclesService } from './vehicles.service';
import { BuyVehicleDto, RepairVehicleDto } from './dto/vehicles.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('vehicles')
@UseGuards(AuthGuard('jwt'))
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get('catalog')
  async getCatalog() {
    return this.vehiclesService.getCatalog();
  }

  @Get('my')
  async getMyVehicles(@CurrentUser('id') userId: string) {
    return this.vehiclesService.getPlayerVehicles(userId);
  }

  @Post('buy')
  async buyVehicle(
    @CurrentUser('id') userId: string,
    @Body() dto: BuyVehicleDto,
  ) {
    return this.vehiclesService.buyVehicle(userId, dto);
  }

  @Post(':id/primary')
  async setPrimary(
    @CurrentUser('id') userId: string,
    @Param('id') vehicleId: string,
  ) {
    return this.vehiclesService.setPrimary(userId, vehicleId);
  }

  @Post('repair')
  async repair(
    @CurrentUser('id') userId: string,
    @Body() dto: RepairVehicleDto,
  ) {
    return this.vehiclesService.repairVehicle(userId, dto.vehicleId);
  }
}
