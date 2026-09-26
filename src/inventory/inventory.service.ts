import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getPlayerInventory(userId: string) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
      include: {
        inventory: { include: { template: true } },
        weapons: true,
      },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    return { inventory: player.inventory, weapons: player.weapons };
  }

  async addItemToInventory(userId: string, templateId: string, quantity: number = 1) {
    const player = await this.prisma.player.findUnique({ where: { userId } });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const template = await this.prisma.itemTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Item template not found');
    }

    // Check if item already exists in inventory
    const existingItem = await this.prisma.inventoryItem.findFirst({
      where: { playerId: player.id, templateId },
    });

    if (existingItem) {
      return this.prisma.inventoryItem.update({
        where: { id: existingItem.id },
        data: { quantity: { increment: quantity } },
      });
    }

    return this.prisma.inventoryItem.create({
      data: {
        playerId: player.id,
        templateId,
        quantity,
      },
    });
  }

  async removeItemFromInventory(userId: string, itemId: string, quantity: number = 1) {
    const player = await this.prisma.player.findUnique({ where: { userId } });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, playerId: player.id },
    });

    if (!item) {
      throw new NotFoundException('Item not found in inventory');
    }

    if (item.quantity <= quantity) {
      return this.prisma.inventoryItem.delete({ where: { id: itemId } });
    }

    return this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: { quantity: { decrement: quantity } },
    });
  }

  async equipItem(userId: string, itemId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, playerId: player.id },
    });

    if (!item) {
      throw new NotFoundException('Item not found in inventory');
    }

    // Unequip all items of the same type
    await this.prisma.inventoryItem.updateMany({
      where: { playerId: player.id, equipped: true },
      data: { equipped: false },
    });

    return this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: { equipped: true },
    });
  }

  async addWeapon(userId: string, name: string, damage: number, range: number, accuracy: number) {
    const player = await this.prisma.player.findUnique({ where: { userId } });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    return this.prisma.playerWeapon.create({
      data: {
        playerId: player.id,
        name,
        damage,
        range,
        accuracy,
        equipped: false,
      },
    });
  }

  async equipWeapon(userId: string, weaponId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    // Unequip all weapons
    await this.prisma.playerWeapon.updateMany({
      where: { playerId: player.id, equipped: true },
      data: { equipped: false },
    });

    return this.prisma.playerWeapon.update({
      where: { id: weaponId },
      data: { equipped: true },
    });
  }
}
