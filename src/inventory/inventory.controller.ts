import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { InventoryService } from './inventory.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class BuyCatalogItemDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  @IsOptional()
  @IsIn(['EUR', 'VIDACOIN'])
  currency?: 'EUR' | 'VIDACOIN';
}

class AddInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;
}

class RemoveInventoryItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;
}

class AddWeaponDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsInt()
  @Min(1)
  @Max(500)
  damage: number;

  @IsInt()
  @Min(1)
  @Max(500)
  range: number;

  @IsInt()
  @Min(1)
  @Max(100)
  accuracy: number;
}

@Controller('inventory')
@UseGuards(AuthGuard('jwt'))
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get('shop')
  async getShopCatalog() {
    return this.inventoryService.getShopCatalog();
  }

  @Post('buy')
  async buyItem(
    @Req() req: { user: { id: string } },
    @Body() dto: BuyCatalogItemDto,
  ) {
    return this.inventoryService.buyCatalogItem(
      req.user.id,
      dto.templateId,
      dto.quantity ?? 1,
      dto.currency,
    );
  }

  @Get()
  async getInventory(@Req() req: { user: { id: string } }) {
    return this.inventoryService.getPlayerInventory(req.user.id);
  }

  @Post('add')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async addItem(
    @Req() req: { user: { id: string } },
    @Body() dto: AddInventoryItemDto,
  ) {
    return this.inventoryService.addItemToInventory(
      req.user.id,
      dto.templateId,
      dto.quantity ?? 1,
    );
  }

  @Post('remove/:itemId')
  async removeItem(
    @Req() req: { user: { id: string } },
    @Param('itemId') itemId: string,
    @Body() dto: RemoveInventoryItemDto,
  ) {
    return this.inventoryService.removeItemFromInventory(
      req.user.id,
      itemId,
      dto.quantity ?? 1,
    );
  }

  @Post('equip/:itemId')
  async equipItem(@Req() req: { user: { id: string } }, @Param('itemId') itemId: string) {
    return this.inventoryService.equipItem(req.user.id, itemId);
  }

  @Post('unequip/:itemId')
  async unequipItem(@Req() req: { user: { id: string } }, @Param('itemId') itemId: string) {
    return this.inventoryService.unequipItem(req.user.id, itemId);
  }

  @Post('use/:itemId')
  async useItem(@Req() req: { user: { id: string } }, @Param('itemId') itemId: string) {
    return this.inventoryService.useItem(req.user.id, itemId);
  }

  @Post('weapons/add')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async addWeapon(
    @Req() req: { user: { id: string } },
    @Body() dto: AddWeaponDto,
  ) {
    return this.inventoryService.addWeapon(
      req.user.id,
      dto.name,
      dto.damage,
      dto.range,
      dto.accuracy,
    );
  }

  @Post('weapons/equip/:weaponId')
  async equipWeapon(@Req() req: { user: { id: string } }, @Param('weaponId') weaponId: string) {
    return this.inventoryService.equipWeapon(req.user.id, weaponId);
  }
}
