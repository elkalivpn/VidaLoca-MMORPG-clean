import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BuyVehicleDto } from './dto/vehicles.dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async getCatalog() {
    return this.prisma.vehicleTemplate.findMany({
      orderBy: { priceEuros: 'asc' },
    });
  }

  async getPlayerVehicles(userId: string) {
    const player = await this.getPlayerOrThrow(userId);
    return this.prisma.playerVehicle.findMany({
      where: { playerId: player.id },
      include: { template: true },
      orderBy: { isPrimary: 'desc' },
    });
  }

  async buyVehicle(userId: string, dto: BuyVehicleDto) {
    const player = await this.getPlayerOrThrow(userId);
    const template = await this.prisma.vehicleTemplate.findUnique({
      where: { id: dto.templateId },
    });

    if (!template) throw new NotFoundException('Vehicle not found in catalog');

    // Prefer Euros, fallback to VidaCoins if priced that way (never charge both)
    const useEuros = (template.priceEuros ?? 0) > 0;
    const priceEuros = useEuros ? template.priceEuros! : 0;
    const priceVida = !useEuros ? (template.priceVida ?? 0) : 0;

    if (priceEuros <= 0 && priceVida <= 0) {
      throw new BadRequestException('Vehicle has no valid price');
    }

    if (useEuros && player.euros < priceEuros) {
      throw new BadRequestException(
        `Not enough Euros. Need ${priceEuros}, have ${player.euros}`,
      );
    }
    if (!useEuros && player.vidaCoins < priceVida) {
      throw new BadRequestException(
        `Not enough VidaCoins. Need ${priceVida}, have ${player.vidaCoins}`,
      );
    }

    const licensePlate = this.generateLicensePlate();

    return this.prisma.$transaction(async (tx) => {
      // Atomic deduct money
      if (useEuros) {
        const debit = await tx.player.updateMany({
          where: { id: player.id, euros: { gte: priceEuros } },
          data: { euros: { decrement: priceEuros } },
        });
        if (debit.count === 0) {
          throw new BadRequestException('Not enough Euros');
        }
      } else {
        const debit = await tx.player.updateMany({
          where: { id: player.id, vidaCoins: { gte: priceVida } },
          data: { vidaCoins: { decrement: priceVida } },
        });
        if (debit.count === 0) {
          throw new BadRequestException('Not enough VidaCoins');
        }
      }

      // Create vehicle
      const vehicle = await tx.playerVehicle.create({
        data: {
          playerId: player.id,
          templateId: template.id,
          licensePlate,
          color: dto.color || 'white',
          condition: 100,
          isPrimary: false,
        },
        include: { template: true },
      });

      // Log transaction for the selected currency
      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'PURCHASE',
          amount: useEuros ? priceEuros : priceVida,
          currency: useEuros ? 'EUR' : 'VIDACOIN',
          reason: `Bought vehicle: ${template.name}`,
          reference: vehicle.id,
        },
      });

      return vehicle;
    });
  }

  async setPrimary(userId: string, vehicleId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const vehicle = await this.prisma.playerVehicle.findFirst({
      where: { id: vehicleId, playerId: player.id },
    });

    if (!vehicle) throw new NotFoundException('Vehicle not found');

    return this.prisma.$transaction(async (tx) => {
      // Unset previous primary
      await tx.playerVehicle.updateMany({
        where: { playerId: player.id, isPrimary: true },
        data: { isPrimary: false },
      });

      return tx.playerVehicle.update({
        where: { id: vehicleId },
        data: { isPrimary: true },
        include: { template: true },
      });
    });
  }

  async repairVehicle(userId: string, vehicleId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const vehicle = await this.prisma.playerVehicle.findFirst({
      where: { id: vehicleId, playerId: player.id },
      include: { template: true },
    });

    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.condition >= 100) {
      throw new BadRequestException('Vehicle is already in perfect condition');
    }

    // Repair cost: 1% of vehicle price per missing % of condition
    const basePrice = vehicle.template.priceEuros || 10000;
    const missing = 100 - vehicle.condition;
    const cost = Math.round((basePrice * 0.01 * missing) * 100) / 100;

    if (player.euros < cost) {
      throw new BadRequestException(`Repair costs ${cost}€. You have ${player.euros}€`);
    }

    return this.prisma.$transaction(async (tx) => {
      const debit = await tx.player.updateMany({
        where: { id: player.id, euros: { gte: cost } },
        data: { euros: { decrement: cost } },
      });

      if (debit.count === 0) {
        throw new BadRequestException(`Repair costs ${cost}€. Insufficient Euros`);
      }

      const repaired = await tx.playerVehicle.update({
        where: { id: vehicleId },
        data: { condition: 100 },
        include: { template: true },
      });

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'SPEND',
          amount: cost,
          currency: 'EUR',
          reason: `Repaired vehicle: ${vehicle.template.name}`,
          reference: vehicleId,
        },
      });

      return { vehicle: repaired, cost };
    });
  }

  private generateLicensePlate(): string {
    const letters = 'BCDFGHJKLMNPRSTVWXYZ';
    const pick = (n: number) =>
      Array.from({ length: n }, () =>
        letters[Math.floor(Math.random() * letters.length)],
      ).join('');
    const nums = Math.floor(1000 + Math.random() * 9000);
    return `${pick(4)}${nums}`;
  }

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }
}
