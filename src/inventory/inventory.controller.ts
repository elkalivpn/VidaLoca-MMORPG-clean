import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'))
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  async getInventory(@Req() req) {
    return this.inventoryService.getPlayerInventory(req.user.id);
  }

  @Post('add')
  async addItem(
    @Req() req,
    @Body('templateId') templateId: string,
    @Body('quantity') quantity: number = 1,
  ) {
    return this.inventoryService.addItemToInventory(req.user.id, templateId, quantity);
  }

  @Post('remove/:itemId')
  async removeItem(
    @Req() req,
    @Param('itemId') itemId: string,
    @Body('quantity') quantity: number = 1,
  ) {
    return this.inventoryService.removeItemFromInventory(req.user.id, itemId, quantity);
  }

  @Post('equip/:itemId')
  async equipItem(@Req() req, @Param('itemId') itemId: string) {
    return this.inventoryService.equipItem(req.user.id, itemId);
  }

  @Post('weapons/add')
  async addWeapon(
    @Req() req,
    @Body('name') name: string,
    @Body('damage') damage: number,
    @Body('range') range: number,
    @Body('accuracy') accuracy: number,
  ) {
    return this.inventoryService.addWeapon(req.user.id, name, damage, range, accuracy);
  }

  @Post('weapons/equip/:weaponId')
  async equipWeapon(@Req() req, @Param('weaponId') weaponId: string) {
    return this.inventoryService.equipWeapon(req.user.id, weaponId);
  }
}
