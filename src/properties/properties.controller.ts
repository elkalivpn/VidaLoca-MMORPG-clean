import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PropertiesService } from './properties.service';
import { BuyPropertyDto } from './dto/properties.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('properties')
@UseGuards(AuthGuard('jwt'))
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) {}

  @Get('catalog')
  async getCatalog() {
    return this.propertiesService.getCatalog();
  }

  @Get('my')
  async getMyProperties(@CurrentUser('id') userId: string) {
    return this.propertiesService.getPlayerProperties(userId);
  }

  @Post('buy')
  async buyProperty(
    @CurrentUser('id') userId: string,
    @Body() dto: BuyPropertyDto,
  ) {
    return this.propertiesService.buyProperty(userId, dto);
  }

  @Post(':id/rent')
  async collectRent(
    @CurrentUser('id') userId: string,
    @Param('id') propertyId: string,
  ) {
    return this.propertiesService.collectRent(userId, propertyId);
  }
}
