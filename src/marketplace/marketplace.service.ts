import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarketListingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateLevelFromXp } from '../common/utils/level.util';
import { isPlayerVipActive } from '../common/utils/vip.util';
import { CreateListingDto } from './dto/marketplace.dto';

export const MARKETPLACE_FEE_RATE = 0.05; // 5% sink estándar
export const MARKETPLACE_VIP_FEE_RATE = 0.02; // 2% tasa reducida Club VIP

export interface VipShopOffer {
  id: string;
  name: string;
  description: string;
  priceVida: number;
  category: 'VIP' | 'UTILITY' | 'CHARACTER' | 'CLOTHING' | 'WEAPON' | 'COSMETIC';
  templateName?: string;
}

export const VIP_SHOP_OFFERS: VipShopOffer[] = [
  {
    id: 'vip_7d',
    name: 'Club VIP VidaLoca (7 días)',
    description:
      '+25% XP global, +15% € en misiones y rentas, 2% tasa P2P y acceso a misiones/vehículos/mansiones VIP.',
    priceVida: 120,
    category: 'VIP',
  },
  {
    id: 'vip_30d',
    name: 'Club VIP VidaLoca (30 días)',
    description:
      'Mes completo VIP con todos los multiplicadores, catálogo exclusivo y ahorro de 120 VC.',
    priceVida: 360,
    category: 'VIP',
  },
  {
    id: 'vip_90d',
    name: 'Club VIP VidaLoca (90 días · Trimestre)',
    description:
      '90 días de estatus 👑 VIP máximo con ahorro de 640 VC frente a pases semanales.',
    priceVida: 900,
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
    id: 'vip_xp_pack',
    name: 'Contrato Relámpago +1.000 XP',
    description:
      'Inyección directa de +1.000 XP en tu expediente para acelerar subidas de nivel.',
    priceVida: 50,
    category: 'UTILITY',
  },
  {
    id: 'vip_euro_briefcase',
    name: 'Maletín Blindado +15.000 €',
    description:
      'Liquidez inmediata de 15.000 € limpios acreditados al instante en tu cuenta.',
    priceVida: 80,
    category: 'UTILITY',
  },
  {
    id: 'gadget_blackbox',
    name: 'Caja Negra Anti-Radar Pro',
    description:
      'Contramedida electrónica que reduce calor y mejora huida en golpes (intercambiable P2P).',
    priceVida: 50,
    category: 'UTILITY',
    templateName: 'Caja Negra Anti-Radar Pro',
  },
  {
    id: 'skill_master_vip',
    name: 'Carta Maestra: Imperio VIP',
    description:
      'Manual confidencial de alta gestión y expansión patrimonial (intercambiable P2P).',
    priceVida: 70,
    category: 'UTILITY',
    templateName: 'Carta Maestra: Imperio VIP',
  },
  {
    id: 'char_dona_ibiza',
    name: 'La Jefa de Ibiza',
    description:
      'Personaje jugable exclusivo con +10% reputación y presencia nocturna balear (equipa en Personaje).',
    priceVida: 140,
    category: 'CHARACTER',
    templateName: 'La Jefa de Ibiza',
  },
  {
    id: 'char_sombra_madrid',
    name: 'Agente Sombra CNI',
    description:
      'Operador encubierto de élite con sigilo mejorado en infiltraciones urbanas.',
    priceVida: 110,
    category: 'CHARACTER',
    templateName: 'Agente Sombra CNI',
  },
  {
    id: 'char_piloto_apex',
    name: 'Piloto Nocturno Apex',
    description:
      'As del volante underground especializado en fugas de autopista y circuitos.',
    priceVida: 95,
    category: 'CHARACTER',
    templateName: 'Piloto Nocturno Apex',
  },
  {
    id: 'char_magnate_banus',
    name: 'Magnate de Puerto Banús',
    description:
      'Perfil legendario de alto standing con bonificación de negociación en Marbella.',
    priceVida: 160,
    category: 'CHARACTER',
    templateName: 'Magnate de Puerto Banús',
  },
  {
    id: 'cloth_traje_marbella',
    name: 'Esmoquin Blanco Puerto Banús',
    description:
      'Vestimenta de gala VIP perfecta para casinos, clubes exclusivos y subastas.',
    priceVida: 55,
    category: 'CLOTHING',
    templateName: 'Esmoquin Blanco Puerto Banús',
  },
  {
    id: 'cloth_chaqueta_drift',
    name: 'Chaqueta Cuero Apex Drift',
    description:
      'Prenda técnica ignífuga para pilotos nocturnos (intercambiable en P2P).',
    priceVida: 40,
    category: 'CLOTHING',
    templateName: 'Chaqueta Cuero Apex Drift',
  },
  {
    id: 'cloth_traje_blindado',
    name: 'Gabardina Táctica Kevlar',
    description:
      'Abrigo elegante con placas balísticas ocultas (+22 blindaje en asaltos).',
    priceVida: 85,
    category: 'CLOTHING',
    templateName: 'Gabardina Táctica Kevlar',
  },
  {
    id: 'cloth_gafas_oro',
    name: 'Gafas Aviador Oro 24K',
    description:
      'Complemento de lujo con filtro nocturno polarizado y carisma VIP.',
    priceVida: 35,
    category: 'CLOTHING',
    templateName: 'Gafas Aviador Oro 24K',
  },
  {
    id: 'weap_desert_gold',
    name: 'Desert Eagle Baño Oro',
    description:
      'Pistola pesada calibre .50 personalizada en oro de colección (equipa o vende en P2P).',
    priceVida: 125,
    category: 'WEAPON',
    templateName: 'Desert Eagle Baño Oro',
  },
  {
    id: 'weap_katana_neo',
    name: 'Katana Fibra Carbono Neo',
    description:
      'Hoja táctica silenciosa ultraligera para infiltraciones sin disparos.',
    priceVida: 90,
    category: 'WEAPON',
    templateName: 'Katana Fibra Carbono Neo',
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
      if (invItem.equipped) {
        throw new BadRequestException(
          'Desequipa el objeto antes de ponerlo a la venta en el mercado P2P',
        );
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

      const seller = await tx.player.findUnique({
        where: { id: listing.sellerId },
        select: { isVip: true, vipExpiresAt: true },
      });
      const sellerIsVip = seller ? isPlayerVipActive(seller) : false;
      const feeRate = sellerIsVip
        ? MARKETPLACE_VIP_FEE_RATE
        : MARKETPLACE_FEE_RATE;
      const fee = Math.round(listing.priceEuros * feeRate * 100) / 100;
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
            reason: `P2P Venta (${sellerIsVip ? '2% tasa VIP' : '5% tasa'}): ${listing.quantity}x ${listing.template.name}`,
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
        feeRate,
        vipDiscountApplied: sellerIsVip,
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

      if (
        offer.id === 'vip_7d' ||
        offer.id === 'vip_30d' ||
        offer.id === 'vip_90d'
      ) {
        const days = offer.id === 'vip_7d' ? 7 : offer.id === 'vip_30d' ? 30 : 90;
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
      } else if (offer.id === 'vip_xp_pack') {
        const newXp = (player.xp ?? 0) + 1000;
        const calcLevel = calculateLevelFromXp(newXp);
        const newLevel = calcLevel > (player.level ?? 1) ? calcLevel : player.level;
        await tx.player.update({
          where: { id: player.id },
          data: { xp: newXp, level: newLevel },
        });
        detail = `+1.000 XP añadidos (Nv.${newLevel})`;
      } else if (offer.id === 'vip_euro_briefcase') {
        await tx.player.update({
          where: { id: player.id },
          data: { euros: { increment: 15000 } },
        });
        detail = '+15.000 € acreditados en tu cuenta';
      } else if (offer.templateName) {
        const tpl = await tx.itemTemplate.findFirst({
          where: { name: offer.templateName },
        });
        if (!tpl) {
          throw new NotFoundException(
            `Plantilla "${offer.templateName}" no disponible aún`,
          );
        }
        const existing = await tx.inventoryItem.findFirst({
          where: { playerId: player.id, templateId: tpl.id, equipped: false },
        });
        if (existing) {
          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: 1 } },
          });
        } else {
          await tx.inventoryItem.create({
            data: {
              playerId: player.id,
              templateId: tpl.id,
              quantity: 1,
              equipped: false,
            },
          });
        }
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
