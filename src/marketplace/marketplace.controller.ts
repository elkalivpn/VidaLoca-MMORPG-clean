import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MarketplaceService } from './marketplace.service';
import { BuyVipItemDto, CreateListingDto } from './dto/marketplace.dto';

@Controller('marketplace')
@UseGuards(AuthGuard('jwt'))
export class MarketplaceController {
  constructor(private marketplaceService: MarketplaceService) {}

  @Get('listings')
  async getListings() {
    return this.marketplaceService.listActiveListings();
  }

  @Post('listings')
  async createListing(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateListingDto,
  ) {
    return this.marketplaceService.createListing(userId, dto);
  }

  @Post('listings/:id/buy')
  async buyListing(
    @CurrentUser('id') userId: string,
    @Param('id') listingId: string,
  ) {
    return this.marketplaceService.buyListing(userId, listingId);
  }

  @Post('listings/:id/cancel')
  async cancelListing(
    @CurrentUser('id') userId: string,
    @Param('id') listingId: string,
  ) {
    return this.marketplaceService.cancelListing(userId, listingId);
  }

  @Get('vip-shop')
  getVipShop() {
    return this.marketplaceService.getVipShopCatalog();
  }

  @Post('vip-shop/buy')
  async buyVipOffer(
    @CurrentUser('id') userId: string,
    @Body() dto: BuyVipItemDto,
  ) {
    return this.marketplaceService.buyVipOffer(userId, dto.offerId);
  }
}
