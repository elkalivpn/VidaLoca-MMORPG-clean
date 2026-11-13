import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BuyPropertyDto } from './dto/properties.dto';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async getCatalog() {
    return this.prisma.propertyTemplate.findMany({
      orderBy: { priceEuros: 'asc' },
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

    if (player.euros < template.priceEuros) {
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
      const whereClause: any = {
        id: player.id,
        euros: { gte: template.priceEuros },
      };
      const updateData: any = {
        euros: { decrement: template.priceEuros },
      };
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
          amount: template.priceEuros,
          currency: 'EUR',
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

    const yieldRate = property.template.rentYield ?? 0.02; // 2% default
    const rent = Math.round(property.template.priceEuros * yieldRate * 100) / 100;

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
          reason: `Rent from: ${property.template.name}`,
          reference: propertyId,
        },
      });

      return { rent, newBalance: updated.euros };
    });
  }

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }
}
