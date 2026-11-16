import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ItemType, SkillCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateLevelFromXp } from '../common/utils/level.util';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getShopCatalog() {
    return this.prisma.itemTemplate.findMany({
      orderBy: [{ type: 'asc' }, { priceEuros: 'asc' }, { priceVida: 'asc' }],
    });
  }

  async getPlayerInventory(userId: string) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
      include: {
        inventory: {
          include: { template: true },
          orderBy: [{ equipped: 'desc' }, { acquiredAt: 'desc' }],
        },
        weapons: true,
      },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    return { inventory: player.inventory, weapons: player.weapons };
  }

  async buyCatalogItem(
    userId: string,
    templateId: string,
    quantity: number = 1,
    currency?: 'EUR' | 'VIDACOIN',
  ) {
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
      throw new BadRequestException(
        'La cantidad debe ser un entero entre 1 y 100',
      );
    }

    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const template = await this.prisma.itemTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException('Artículo no encontrado en el catálogo');
    }

    const hasEuros = (template.priceEuros ?? 0) > 0;
    const hasVida = (template.priceVida ?? 0) > 0;
    let useEuros: boolean;

    if (currency === 'VIDACOIN') {
      if (!hasVida) {
        throw new BadRequestException(
          'Este artículo no se vende en VidaCoins',
        );
      }
      useEuros = false;
    } else if (currency === 'EUR') {
      if (!hasEuros) {
        throw new BadRequestException('Este artículo solo se vende en VidaCoins');
      }
      useEuros = true;
    } else {
      useEuros = hasEuros;
    }

    const unitCost = useEuros
      ? (template.priceEuros ?? 0)
      : (template.priceVida ?? 0);
    if (unitCost <= 0) {
      throw new BadRequestException(
        'Este artículo exclusivo no está a la venta directa en tienda estándar',
      );
    }

    const totalCost = Math.round(unitCost * quantity * 100) / 100;

    return this.prisma.$transaction(async (tx) => {
      if (useEuros) {
        const debit = await tx.player.updateMany({
          where: { id: player.id, euros: { gte: totalCost } },
          data: { euros: { decrement: totalCost } },
        });
        if (debit.count === 0) {
          throw new BadRequestException(
            `No tienes suficientes euros (necesitas ${totalCost}€)`,
          );
        }
      } else {
        const debit = await tx.player.updateMany({
          where: { id: player.id, vidaCoins: { gte: totalCost } },
          data: { vidaCoins: { decrement: totalCost } },
        });
        if (debit.count === 0) {
          throw new BadRequestException(
            `No tienes suficientes VidaCoins (necesitas ${totalCost} VC)`,
          );
        }
      }

      const existingStack = await tx.inventoryItem.findFirst({
        where: { playerId: player.id, templateId: template.id, equipped: false },
      });

      const item = existingStack
        ? await tx.inventoryItem.update({
            where: { id: existingStack.id },
            data: { quantity: { increment: quantity } },
            include: { template: true },
          })
        : await tx.inventoryItem.create({
            data: {
              playerId: player.id,
              templateId: template.id,
              quantity,
              equipped: false,
            },
            include: { template: true },
          });

      if (template.type === ItemType.WEAPON) {
        const stats = (template.stats ?? {}) as Record<string, unknown>;
        const existingWeapon = await tx.playerWeapon.findFirst({
          where: { playerId: player.id, name: template.name },
        });
        if (!existingWeapon) {
          await tx.playerWeapon.create({
            data: {
              playerId: player.id,
              name: template.name,
              damage: typeof stats.damage === 'number' ? stats.damage : 30,
              range: typeof stats.range === 'number' ? stats.range : 40,
              accuracy: typeof stats.accuracy === 'number' ? stats.accuracy : 75,
              equipped: false,
            },
          });
        }
      }

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'PURCHASE',
          amount: totalCost,
          currency: useEuros ? 'EUR' : 'VIDACOIN',
          reason: `Tienda: ${quantity}x ${template.name}`,
          reference: template.id,
        },
      });

      return {
        item,
        quantity,
        totalCost,
        currency: useEuros ? 'EUR' : 'VIDACOIN',
        message: `Comprado ${quantity}x ${template.name}`,
      };
    });
  }

  async addItemToInventory(userId: string, templateId: string, quantity: number = 1) {
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1000) {
      throw new BadRequestException('Quantity must be a positive integer (1..1000)');
    }

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

    const existingItem = await this.prisma.inventoryItem.findFirst({
      where: { playerId: player.id, templateId, equipped: false },
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
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1000) {
      throw new BadRequestException('Quantity must be a positive integer (1..1000)');
    }

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
      include: { template: true },
    });

    if (!item) {
      throw new NotFoundException('Item not found in inventory');
    }

    return this.prisma.$transaction(async (tx) => {
      // Unequip only items of the same category (CHARACTER, CLOTHING, COSMETIC, WEAPON, etc.)
      await tx.inventoryItem.updateMany({
        where: {
          playerId: player.id,
          equipped: true,
          template: { type: item.template.type },
        },
        data: { equipped: false },
      });

      return tx.inventoryItem.update({
        where: { id: itemId },
        data: { equipped: true },
        include: { template: true },
      });
    });
  }

  async unequipItem(userId: string, itemId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, playerId: player.id },
      include: { template: true },
    });
    if (!item) {
      throw new NotFoundException('Item not found in inventory');
    }
    if (!item.equipped) {
      throw new BadRequestException('Este objeto no está equipado');
    }

    return this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: { equipped: false },
      include: { template: true },
    });
  }

  async useItem(userId: string, itemId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const invItem = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, playerId: player.id },
      include: { template: true },
    });
    if (!invItem) {
      throw new NotFoundException('Objeto no encontrado en tu inventario');
    }

    const type = invItem.template.type;
    if (type !== ItemType.CONSUMABLE && type !== ItemType.SKILL_CARD) {
      throw new BadRequestException(
        'Solo los consumibles, gadgets y cartas de habilidad pueden usarse directamente',
      );
    }

    const stats = (invItem.template.stats ?? {}) as Record<string, unknown>;

    return this.prisma.$transaction(async (tx) => {
      const dec = await tx.inventoryItem.updateMany({
        where: { id: invItem.id, playerId: player.id, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (dec.count === 0) {
        throw new BadRequestException('No quedan unidades de este objeto');
      }

      if (invItem.quantity <= 1) {
        await tx.inventoryItem.deleteMany({
          where: { id: invItem.id, quantity: { lte: 0 } },
        });
      }

      const freshPlayer = await tx.player.findUnique({
        where: { id: player.id },
      });
      if (!freshPlayer) {
        throw new NotFoundException('Player not found');
      }

      let heatDelta = 0;
      let xpDelta = 0;
      let eurosDelta = 0;
      const notes: string[] = [];

      const heatReduction =
        typeof stats.heatReduction === 'number'
          ? stats.heatReduction
          : typeof stats.heatClear === 'number'
            ? stats.heatClear
            : 0;
      if (heatReduction > 0) {
        heatDelta = -Math.abs(heatReduction);
        notes.push(`-${Math.abs(heatReduction)} calor policial`);
      }

      if (typeof stats.xpGrant === 'number' && stats.xpGrant > 0) {
        xpDelta += Math.floor(stats.xpGrant);
        notes.push(`+${Math.floor(stats.xpGrant)} XP`);
      } else if (type === ItemType.CONSUMABLE) {
        xpDelta += 25;
        notes.push('+25 XP tácticos');
      }

      if (typeof stats.eurosGrant === 'number' && stats.eurosGrant > 0) {
        eurosDelta += stats.eurosGrant;
        notes.push(`+${stats.eurosGrant} €`);
      }

      const nextHeat = Math.max(
        0,
        Math.min(100, (freshPlayer.heat ?? 0) + heatDelta),
      );
      const nextWanted = Math.min(5, Math.floor(nextHeat / 20));
      const nextXp = (freshPlayer.xp ?? 0) + xpDelta;
      const calcLevel = calculateLevelFromXp(nextXp);
      const nextLevel =
        calcLevel > (freshPlayer.level ?? 1) ? calcLevel : freshPlayer.level;

      const updatedPlayer = await tx.player.update({
        where: { id: freshPlayer.id },
        data: {
          heat: nextHeat,
          wantedLevel: nextWanted,
          xp: nextXp,
          level: nextLevel,
          ...(eurosDelta > 0 ? { euros: { increment: eurosDelta } } : {}),
        },
      });

      if (type === ItemType.SKILL_CARD) {
        const rawCat =
          typeof stats.skillCategory === 'string'
            ? stats.skillCategory.toUpperCase()
            : 'STEALTH';
        const validCats = Object.values(SkillCategory) as string[];
        const targetCat = validCats.includes(rawCat)
          ? (rawCat as SkillCategory)
          : SkillCategory.STEALTH;
        const skill = await tx.skill.findFirst({
          where: { category: targetCat },
        });
        if (skill) {
          const existingSkill = await tx.playerSkill.findUnique({
            where: {
              playerId_skillId: { playerId: freshPlayer.id, skillId: skill.id },
            },
          });
          const skillXpGain =
            typeof stats.xpGrant === 'number' ? Math.round(stats.xpGrant * 0.25) : 100;
          if (!existingSkill) {
            await tx.playerSkill.create({
              data: {
                playerId: freshPlayer.id,
                skillId: skill.id,
                level: Math.min(skill.maxLevel, 2),
                xp: skillXpGain % 100,
              },
            });
          } else {
            const totalSkillXp = existingSkill.xp + skillXpGain;
            const threshold = existingSkill.level * 100;
            const levelGain = totalSkillXp >= threshold ? 1 : 0;
            await tx.playerSkill.update({
              where: { id: existingSkill.id },
              data: {
                level: Math.min(skill.maxLevel, existingSkill.level + levelGain),
                xp: levelGain > 0 ? totalSkillXp - threshold : totalSkillXp,
              },
            });
          }
          notes.push(`Habilidad ${skill.name} mejorada`);
        }
      }

      return {
        used: true,
        itemId: invItem.id,
        itemName: invItem.template.name,
        remainingQuantity: Math.max(0, invItem.quantity - 1),
        heat: updatedPlayer.heat,
        xp: updatedPlayer.xp,
        level: updatedPlayer.level,
        message:
          notes.length > 0
            ? `Usaste ${invItem.template.name}: ${notes.join(' · ')}.`
            : `Usaste ${invItem.template.name} con éxito.`,
      };
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

    return this.prisma.$transaction(async (tx) => {
      const weapon = await tx.playerWeapon.findFirst({
        where: { id: weaponId, playerId: player.id },
      });

      if (!weapon) {
        throw new NotFoundException('Weapon not found');
      }

      // Unequip all weapons
      await tx.playerWeapon.updateMany({
        where: { playerId: player.id, equipped: true },
        data: { equipped: false },
      });

      return tx.playerWeapon.update({
        where: { id: weaponId },
        data: { equipped: true },
      });
    });
  }
}
