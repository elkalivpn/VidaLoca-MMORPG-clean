import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarketListingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/marketplace.dto';

export const MARKETPLACE_FEE_RATE = 0.05; // 5% sink anti-inflación

export interface VipShopOffer {
  id: string;
  name: string;
  description: string;
  priceVida: number;
  category: 'VIP' | 'UTILITY' | 'COSMETIC';
  templateName?: string;
}

export const VIP_SHOP_OFFERS: VipShopOffer[] = [
  {
    id: 'vip_7d',
    name: 'Club VIP VidaLoca (7 días)',
    description:
      '+25% XP en calle, misiones, racha diaria y retos + insignia dorada 👑 VIP.',
    priceVida: 120,
    category: 'VIP',
  },
  {
    id: 'vip_30d',
    name: 'Club VIP VidaLoca (30 días)',
    description:
      'Mes completo con +25% XP global, insignia 👑 VIP y ahorro de 120 VC.',
    priceVida: 360,
    category: 'VIP',
  },
  {
    id: 'clear_heat',
    name: 'Soborno Limpio (Calor a 0)',
    description:
      'Borra instantáneamente todo tu nivel de búsqueda (Heat 0) y antecedentes activos.',
    priceVida: 35,
    category: 'UTILITY',
  },
  {
    id: 'cosmetic_plate',
    name: 'Matrícula Dorada VIP',
    description:
      'Placa personalizada con acabado oro cepillado (intercambiable en P2P).',
    priceVida: 60,
    category: 'COSMETIC',
    templateName: 'Matrícula Dorada VIP',
  },
  {
    id: 'cosmetic_neon',
    name: 'Kit Neón Azul Nocturno',
    description:
      'Iluminación LED inferior para autopistas nocturnas (intercambiable en P2P).',
    priceVida: 45,
    category: 'COSMETIC',
    templateName: 'Kit Neón Azul Nocturno',
  },
  {
    id: 'cosmetic_founder',
    name: 'Emblema Fundador VidaLoca',
    description:
      'Insignia legendaria de prestigio (intercambiable en el Mercado Negro P2P).',
    priceVida: 180,
    category: 'COSMETIC',
    templateName: 'Emblema Fundador VidaLoca',
  },
];

@Injectable()
export class MarketplaceService {
  constructor(private prisma: PrismaService) {}

  async listActiveListings() {
    return this.prisma.marketListing.findMany({
      where: { status: MarketListingStatus.ACTIVE },
      include: {
        template: true,
        seller: {
          select: { id: true, displayName: true, level: true, isVip: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
  }

  async createListing(userId: string, dto: CreateListingDto) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');

    const priceEuros = Math.round(dto.priceEuros * 100) / 100;

    return this.prisma.$transaction(async (tx) => {
      const invItem = await tx.inventoryItem.findFirst({
        where: { id: dto.inventoryItemId, playerId: player.id },
        include: { template: true },
      });

      if (!invItem) {
        throw new NotFoundException('Ítem no encontrado en tu inventario');
      }
      if (invItem.quantity < dto.quantity) {
        throw new BadRequestException(
          `Cantidad insuficiente (tienes ${invItem.quantity})`,
        );
      }

      if (invItem.quantity === dto.quantity) {
        await tx.inventoryItem.delete({ where: { id: invItem.id } });
      } else {
        await tx.inventoryItem.update({
          where: { id: invItem.id },
          data: { quantity: { decrement: dto.quantity } },
        });
      }

      return tx.marketListing.create({
        data: {
          sellerId: player.id,
          templateId: invItem.templateId,
          quantity: dto.quantity,
          priceEuros,
          status: MarketListingStatus.ACTIVE,
        },
        include: {
          template: true,
          seller: {
            select: { id: true, displayName: true, level: true, isVip: true },
          },
        },
      });
    });
  }

  async buyListing(userId: string, listingId: string) {
    const buyer = await this.prisma.player.findUnique({ where: { userId } });
    if (!buyer) throw new NotFoundException('Player not found');

    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({
        where: { id: listingId },
        include: { template: true },
      });
      if (!listing) throw new NotFoundException('Anuncio no encontrado');
      if (listing.status !== MarketListingStatus.ACTIVE) {
        throw new BadRequestException('Este anuncio ya no está disponible');
      }
      if (listing.sellerId === buyer.id) {
        throw new BadRequestException(
          'No puedes comprar tu propio anuncio; cancélalo para recuperarlo.',
        );
      }

      const now = new Date();
      const lock = await tx.marketListing.updateMany({
        where: { id: listing.id, status: MarketListingStatus.ACTIVE },
        data: {
          status: MarketListingStatus.SOLD,
          buyerId: buyer.id,
          soldAt: now,
        },
      });
      if (lock.count === 0) {
        throw new BadRequestException('El anuncio acaba de ser vendido');
      }

      const debit = await tx.player.updateMany({
        where: { id: buyer.id, euros: { gte: listing.priceEuros } },
        data: { euros: { decrement: listing.priceEuros } },
      });
      if (debit.count === 0) {
        throw new BadRequestException(
          `No tienes suficientes euros (necesitas ${listing.priceEuros}€)`,
        );
      }

      const fee = Math.round(listing.priceEuros * MARKETPLACE_FEE_RATE * 100) / 100;
      const sellerNet = Math.round((listing.priceEuros - fee) * 100) / 100;

      await tx.player.update({
        where: { id: listing.sellerId },
        data: { euros: { increment: sellerNet } },
      });

      const existingStack = await tx.inventoryItem.findFirst({
        where: {
          playerId: buyer.id,
          templateId: listing.templateId,
          equipped: false,
        },
      });
      if (existingStack) {
        await tx.inventoryItem.update({
          where: { id: existingStack.id },
          data: { quantity: { increment: listing.quantity } },
        });
      } else {
        await tx.inventoryItem.create({
          data: {
            playerId: buyer.id,
            templateId: listing.templateId,
            quantity: listing.quantity,
            equipped: false,
          },
        });
      }

      await tx.transactionLog.createMany({
        data: [
          {
            playerId: buyer.id,
            type: 'PURCHASE',
            amount: listing.priceEuros,
            currency: 'EUR',
            reason: `P2P Compra: ${listing.quantity}x ${listing.template.name}`,
            reference: listing.id,
          },
          {
            playerId: listing.sellerId,
            type: 'EARN',
            amount: sellerNet,
            currency: 'EUR',
            reason: `P2P Venta (5% tasa): ${listing.quantity}x ${listing.template.name}`,
            reference: listing.id,
          },
        ],
      });

      return {
        listingId: listing.id,
        itemName: listing.template.name,
        quantity: listing.quantity,
        priceEuros: listing.priceEuros,
        feeEuros: fee,
        sellerNetEuros: sellerNet,
      };
    });
  }

  async cancelListing(userId: string, listingId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');

    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({
        where: { id: listingId },
      });
      if (!listing) throw new NotFoundException('Anuncio no encontrado');
      if (listing.sellerId !== player.id) {
        throw new ForbiddenException('No eres el vendedor de este anuncio');
      }
      if (listing.status !== MarketListingStatus.ACTIVE) {
        throw new BadRequestException('El anuncio ya no está activo');
      }

      const lock = await tx.marketListing.updateMany({
        where: { id: listing.id, status: MarketListingStatus.ACTIVE },
        data: { status: MarketListingStatus.CANCELLED },
      });
      if (lock.count === 0) {
        throw new BadRequestException('No se pudo cancelar el anuncio');
      }

      const existingStack = await tx.inventoryItem.findFirst({
        where: {
          playerId: player.id,
          templateId: listing.templateId,
          equipped: false,
        },
      });
      if (existingStack) {
        await tx.inventoryItem.update({
          where: { id: existingStack.id },
          data: { quantity: { increment: listing.quantity } },
        });
      } else {
        await tx.inventoryItem.create({
          data: {
            playerId: player.id,
            templateId: listing.templateId,
            quantity: listing.quantity,
            equipped: false,
          },
        });
      }

      return { cancelled: true, listingId: listing.id };
    });
  }

  getVipShopCatalog() {
    return VIP_SHOP_OFFERS;
  }

  async buyVipOffer(userId: string, offerId: string) {
    const offer = VIP_SHOP_OFFERS.find((o) => o.id === offerId);
    if (!offer) throw new NotFoundException('Oferta VIP no encontrada');

    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');

    return this.prisma.$transaction(async (tx) => {
      const debit = await tx.player.updateMany({
        where: { id: player.id, vidaCoins: { gte: offer.priceVida } },
        data: { vidaCoins: { decrement: offer.priceVida } },
      });
      if (debit.count === 0) {
        throw new BadRequestException(
          `No tienes suficientes VidaCoins (necesitas ${offer.priceVida} VC)`,
        );
      }

      const now = new Date();
      let detail = '';

      if (offer.id === 'vip_7d' || offer.id === 'vip_30d') {
        const days = offer.id === 'vip_7d' ? 7 : 30;
        const baseTime =
          player.vipExpiresAt && player.vipExpiresAt > now
            ? player.vipExpiresAt.getTime()
            : now.getTime();
        const nextExpiry = new Date(baseTime + days * 24 * 60 * 60 * 1000);
        await tx.player.update({
          where: { id: player.id },
          data: { isVip: true, vipExpiresAt: nextExpiry },
        });
        detail = `Club VIP activo hasta ${nextExpiry.toLocaleDateString('es-ES')}`;
      } else if (offer.id === 'clear_heat') {
        await tx.player.update({
          where: { id: player.id },
          data: { heat: 0, wantedLevel: 0, jailUntil: null },
        });
        detail = 'Nivel de búsqueda limpiado a 0';
      } else if (offer.templateName) {
        const tpl = await tx.itemTemplate.findFirst({
          where: { name: offer.templateName },
        });
        if (!tpl) {
          throw new NotFoundException(
            `Plantilla cosmética "${offer.templateName}" no disponible aún`,
          );
        }
        await tx.inventoryItem.create({
          data: {
            playerId: player.id,
            templateId: tpl.id,
            quantity: 1,
            equipped: false,
          },
        });
        detail = `${tpl.name} añadido a tu inventario`;
      }

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'PURCHASE',
          amount: offer.priceVida,
          currency: 'VIDACOIN',
          reason: `Tienda VIP: ${offer.name}`,
          reference: offer.id,
        },
      });

      return {
        offerId: offer.id,
        name: offer.name,
        priceVida: offer.priceVida,
        detail,
      };
    });
  }
}
