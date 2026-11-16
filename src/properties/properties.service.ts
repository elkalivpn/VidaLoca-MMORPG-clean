import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isPlayerVipActive } from '../common/utils/vip.util';
import { BuyPropertyDto } from './dto/properties.dto';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async getCatalog() {
    return this.prisma.propertyTemplate.findMany({
      orderBy: [{ isVipOnly: 'asc' }, { priceEuros: 'asc' }],
    });
  }

  async getPlayerProperties(userId: string) {
    const player = await this.getPlayerOrThrow(userId);
    return this.prisma.playerProperty.findMany({
      where: { playerId: player.id },
      include: { template: true },
      orderBy: { purchasedAt: 'desc' },
    });
  }

  async buyProperty(userId: string, dto: BuyPropertyDto) {
    const player = await this.getPlayerOrThrow(userId);
    const template = await this.prisma.propertyTemplate.findUnique({
      where: { id: dto.templateId },
    });

    if (!template) throw new NotFoundException('Property not found');

    if (template.isVipOnly && !isPlayerVipActive(player)) {
      throw new ForbiddenException(
        'Propiedad exclusiva del Club VIP. Activa tu membresía VIP en Mercado / Club VIP.',
      );
    }

    if (template.priceEuros > 0 && player.euros < template.priceEuros) {
      throw new BadRequestException(
        `Not enough Euros. Need ${template.priceEuros}, have ${player.euros}`,
      );
    }

    if (template.priceVida && player.vidaCoins < template.priceVida) {
      throw new BadRequestException(
        `Not enough VidaCoins. Need ${template.priceVida}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const whereClause: any = { id: player.id };
      const updateData: any = {};
      if (template.priceEuros > 0) {
        whereClause.euros = { gte: template.priceEuros };
        updateData.euros = { decrement: template.priceEuros };
      }
      if (template.priceVida) {
        whereClause.vidaCoins = { gte: template.priceVida };
        updateData.vidaCoins = { decrement: template.priceVida };
      }

      const debit = await tx.player.updateMany({
        where: whereClause,
        data: updateData,
      });

      if (debit.count === 0) {
        throw new BadRequestException('Insufficient funds to buy this property');
      }

      const property = await tx.playerProperty.create({
        data: {
          playerId: player.id,
          templateId: template.id,
        },
        include: { template: true },
      });

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'PURCHASE',
          amount: template.priceEuros > 0 ? template.priceEuros : (template.priceVida ?? 0),
          currency: template.priceEuros > 0 ? 'EUR' : 'VIDACOIN',
          reason: `Bought property: ${template.name}`,
          reference: property.id,
        },
      });

      return property;
    });
  }

  async collectRent(userId: string, propertyId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const property = await this.prisma.playerProperty.findFirst({
      where: { id: propertyId, playerId: player.id },
      include: { template: true },
    });

    if (!property) throw new NotFoundException('Property not found');

    const yieldRate = property.template.rentYield ?? 0.02; // 2% default if fractional, € value if > 1
    const baseRent =
      yieldRate > 1
        ? yieldRate
        : property.template.priceEuros * yieldRate;
    const factionMultiplier = player.faction === 'ENTREPRENEUR' ? 1.15 : 1.0;
    const vipMultiplier = isPlayerVipActive(player) ? 1.15 : 1.0;
    const rent =
      Math.round(baseRent * factionMultiplier * vipMultiplier * 100) / 100;

    if (rent <= 0) {
      throw new BadRequestException('This property generates no rent');
    }

    const RENT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
    const now = new Date();
    const cooldownCutoff = new Date(now.getTime() - RENT_COOLDOWN_MS);

    return this.prisma.$transaction(async (tx) => {
      const claimResult = await tx.playerProperty.updateMany({
        where: {
          id: propertyId,
          playerId: player.id,
          OR: [
            { lastRentCollectedAt: null },
            { lastRentCollectedAt: { lte: cooldownCutoff } },
          ],
        },
        data: { lastRentCollectedAt: now },
      });

      if (claimResult.count === 0) {
        throw new BadRequestException(
          'Rent already collected recently. Please wait 1 hour between collections.',
        );
      }

      const updated = await tx.player.update({
        where: { id: player.id },
        data: { euros: { increment: rent } },
      });

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'EARN',
          amount: rent,
          currency: 'EUR',
          reason: `Rent from: ${property.template.name}${vipMultiplier > 1 ? ' (VIP +15%)' : ''}`,
          reference: propertyId,
        },
      });

      return { rent, newBalance: updated.euros, vipBonusApplied: vipMultiplier > 1 };
    });
  }

  async useProperty(userId: string, propertyId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const property = await this.prisma.playerProperty.findFirst({
      where: { id: propertyId, playerId: player.id },
      include: { template: true },
    });

    if (!property) throw new NotFoundException('Property not found');

    const type = property.template.type;
    const cooldownMsByType: Record<string, number> = {
      WAREHOUSE: 15 * 60 * 1000,
      APARTMENT: 3 * 60 * 1000,
      MANSION: 3 * 60 * 1000,
      CLUB: 30 * 1000,
      GARAGE: 30 * 1000,
    };
    const cooldownMs = cooldownMsByType[type] ?? 60 * 1000;
    const now = new Date();
    const cutoff = new Date(now.getTime() - cooldownMs);

    return this.prisma.$transaction(async (tx) => {
      const claimUse = await tx.playerProperty.updateMany({
        where: {
          id: propertyId,
          playerId: player.id,
          OR: [{ lastUsedAt: null }, { lastUsedAt: { lte: cutoff } }],
        },
        data: { lastUsedAt: now },
      });

      if (claimUse.count === 0) {
        const waitSec = Math.ceil(cooldownMs / 1000);
        throw new BadRequestException(
          `Esta propiedad está en enfriamiento. Espera unos minutos antes de volver a usarla (cooldown ${waitSec}s).`,
        );
      }

      const freshPlayer = await tx.player.findUnique({
        where: { id: player.id },
      });
      if (!freshPlayer) throw new NotFoundException('Player not found');

      if (type === 'APARTMENT' || type === 'MANSION') {
        const currentHeat = freshPlayer.heat ?? 0;
        const newHeat = Math.max(0, currentHeat - 30);
        const heatReduced = Math.max(0, currentHeat - newHeat);
        const newWantedLevel = Math.min(5, Math.floor(newHeat / 20));
        const updated = await tx.player.update({
          where: { id: freshPlayer.id },
          data: { heat: newHeat, wantedLevel: newWantedLevel },
        });
        return {
          propertyId,
          type,
          effect: 'COOL_HEAT',
          heat: updated.heat,
          heatReduced,
          wantedLevel: updated.wantedLevel,
          message: `Te refugias en ${property.template.name}. Tu calor policial baja a ${updated.heat}.`,
        };
      }

      if (type === 'GARAGE') {
        const primaryVehicle = await tx.playerVehicle.findFirst({
          where: { playerId: freshPlayer.id },
          include: { template: true },
          orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
        });

        if (!primaryVehicle) {
          throw new BadRequestException(
            'No tienes ningún vehículo primario para reparar',
          );
        }

        if (primaryVehicle.condition >= 100) {
          throw new BadRequestException(
            'Tu vehículo primario ya está al 100% de condición',
          );
        }

        const repairCost = 50;
        const debit = await tx.player.updateMany({
          where: { id: freshPlayer.id, euros: { gte: repairCost } },
          data: { euros: { decrement: repairCost } },
        });

        if (debit.count === 0) {
          throw new BadRequestException(
            `No tienes suficientes euros para reparar (necesitas ${repairCost}€)`,
          );
        }

        const updatedVehicle = await tx.playerVehicle.update({
          where: { id: primaryVehicle.id },
          data: { condition: 100 },
        });

        await tx.transactionLog.create({
          data: {
            playerId: freshPlayer.id,
            type: 'SPEND',
            amount: repairCost,
            currency: 'EUR',
            reason: `Garage repair (50% off): ${primaryVehicle.template.name}`,
            reference: propertyId,
          },
        });

        return {
          propertyId,
          type,
          effect: 'REPAIR_VEHICLE',
          costEuros: repairCost,
          vehicleId: updatedVehicle.id,
          condition: updatedVehicle.condition,
          repairedCount: 1,
          newEuros: Math.round((freshPlayer.euros - repairCost) * 100) / 100,
          message: `Vehículo ${primaryVehicle.template.name} reparado al 100% por ${repairCost}€ (50% dto).`,
        };
      }

      if (type === 'CLUB') {
        const rawDirty = Math.max(0, freshPlayer.dirtyEuros ?? 0);
        const dirtyAmount =
          Math.floor(rawDirty * 100) / 100 || (rawDirty > 0 ? rawDirty : 0);
        if (dirtyAmount <= 0) {
          throw new BadRequestException(
            'No tienes dinero negro (dirtyEuros) para blanquear',
          );
        }

        const cleanEuros = Math.round(dirtyAmount * 0.85 * 100) / 100;
        const laundered = await tx.player.updateMany({
          where: { id: freshPlayer.id, dirtyEuros: { gte: dirtyAmount } },
          data: {
            dirtyEuros: { decrement: dirtyAmount },
            euros: { increment: cleanEuros },
          },
        });

        if (laundered.count === 0) {
          throw new BadRequestException('No se pudo blanquear el dinero negro');
        }

        await tx.transactionLog.create({
          data: {
            playerId: freshPlayer.id,
            type: 'EARN',
            amount: cleanEuros,
            currency: 'EUR',
            reason: `Money laundering at club: ${property.template.name}`,
            reference: propertyId,
          },
        });

        const updated = await tx.player.findUnique({
          where: { id: freshPlayer.id },
        });

        return {
          propertyId,
          type,
          effect: 'LAUNDER_MONEY',
          dirtyLaundered: dirtyAmount,
          launderedEuros: dirtyAmount,
          cleanEuros,
          earnedEuros: cleanEuros,
          newEuros: updated?.euros ?? freshPlayer.euros + cleanEuros,
          newDirtyEuros: updated?.dirtyEuros ?? 0,
          message: `Has blanqueado ${dirtyAmount}€ negros en ${property.template.name} y obtenido ${cleanEuros}€ limpios (85%).`,
        };
      }

      if (type === 'WAREHOUSE') {
        const bonusEuros = 150;
        const updated = await tx.player.update({
          where: { id: freshPlayer.id },
          data: { euros: { increment: bonusEuros } },
        });

        await tx.transactionLog.create({
          data: {
            playerId: freshPlayer.id,
            type: 'EARN',
            amount: bonusEuros,
            currency: 'EUR',
            reason: `Warehouse logistics bonus: ${property.template.name}`,
            reference: propertyId,
          },
        });

        return {
          propertyId,
          type,
          effect: 'LOGISTICS_BONUS',
          bonusEuros,
          earnedEuros: bonusEuros,
          newEuros: updated.euros,
          message: `Operación logística en ${property.template.name} completada: +${bonusEuros}€.`,
        };
      }

      throw new BadRequestException(`Tipo de propiedad no soportado: ${type}`);
    });
  }

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }
}
