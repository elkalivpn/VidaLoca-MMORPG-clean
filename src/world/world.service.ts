import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ZONE_VIBES,
  ZONES,
  ZONES_BY_ID,
  HIGHWAY_ROUTES,
  isValidZoneId,
  calculateRouteBetweenZones,
} from '../common/constants/zones';
import { calculateLevelFromXp } from '../common/utils/level.util';
import { MarketGoodId, MarketTradeDto } from './dto/market-trade.dto';
import { AntiCheatService } from '../security/anti-cheat.service';

interface MarketGoodDef {
  id: MarketGoodId;
  name: string;
  description: string;
  basePrice: number;
  cityBias: Record<string, number>;
}

const MARKET_GOODS: MarketGoodDef[] = [
  {
    id: 'relojes_lujo',
    name: 'Relojes de Lujo',
    description: 'Cronógrafos suizos de importación discreta.',
    basePrice: 420,
    cityBias: {
      Marbella: 1.25,
      Madrid: 1.1,
      Barcelona: 1.05,
      Valencia: 0.9,
      Sevilla: 0.85,
      Bilbao: 0.95,
      'San Sebastián': 1.22,
      'Vitoria-Gasteiz': 0.95,
      Toledo: 0.88,
      Valladolid: 0.9,
      Salamanca: 0.92,
      Zaragoza: 0.94,
      'A Coruña': 1.04,
      Vigo: 0.86,
      'Santiago de Compostela': 0.95,
      Palma: 1.28,
      Ibiza: 1.34,
      'Las Palmas': 0.82,
      Tenerife: 0.84,
      Málaga: 1.18,
      Granada: 0.92,
      Alicante: 1.15,
      Murcia: 0.87,
      Gijón: 0.9,
      Santander: 1.14,
      Pamplona: 0.98,
      Lanzarote: 1.24,
    },
  },
  {
    id: 'tech_chips',
    name: 'Microchips Industriales',
    description: 'Componentes electrónicos de alta demanda en el mercado gris.',
    basePrice: 280,
    cityBias: {
      Madrid: 1.15,
      Barcelona: 1.2,
      Valencia: 1.0,
      Bilbao: 1.12,
      Sevilla: 0.85,
      Marbella: 0.9,
      'San Sebastián': 1.08,
      'Vitoria-Gasteiz': 1.14,
      Toledo: 0.92,
      Valladolid: 1.05,
      Salamanca: 1.02,
      Zaragoza: 1.1,
      'A Coruña': 0.96,
      Vigo: 0.92,
      'Santiago de Compostela': 0.98,
      Palma: 0.9,
      Ibiza: 0.88,
      'Las Palmas': 0.78,
      Tenerife: 0.8,
      Málaga: 1.24,
      Granada: 0.95,
      Alicante: 1.04,
      Murcia: 0.89,
      Gijón: 0.94,
      Santander: 0.98,
      Pamplona: 1.12,
      Lanzarote: 0.82,
    },
  },
  {
    id: 'aceite_gourmet',
    name: 'Aceite Gourmet D.O.',
    description: 'Lotes premium de exportación rápida sin trazabilidad.',
    basePrice: 95,
    cityBias: {
      Sevilla: 0.75,
      Madrid: 1.15,
      Barcelona: 1.2,
      Bilbao: 1.25,
      Valencia: 0.95,
      Marbella: 1.1,
      'San Sebastián': 1.32,
      'Vitoria-Gasteiz': 1.15,
      Toledo: 0.78,
      Valladolid: 0.92,
      Salamanca: 0.88,
      Zaragoza: 0.96,
      'A Coruña': 1.18,
      Vigo: 1.16,
      'Santiago de Compostela': 1.22,
      Palma: 1.24,
      Ibiza: 1.28,
      'Las Palmas': 1.12,
      Tenerife: 1.14,
      Málaga: 0.82,
      Granada: 0.74,
      Alicante: 0.94,
      Murcia: 0.79,
      Gijón: 1.2,
      Santander: 1.22,
      Pamplona: 1.16,
      Lanzarote: 1.26,
    },
  },
  {
    id: 'piezas_tuning',
    name: 'Piezas Tuning',
    description: 'Turbos, centralitas y kits de escape de competición.',
    basePrice: 190,
    cityBias: {
      Valencia: 0.8,
      Bilbao: 1.15,
      Madrid: 1.1,
      Barcelona: 1.05,
      Sevilla: 0.95,
      Marbella: 1.2,
      'San Sebastián': 1.1,
      'Vitoria-Gasteiz': 0.88,
      Toledo: 0.94,
      Valladolid: 0.86,
      Salamanca: 0.98,
      Zaragoza: 0.9,
      'A Coruña': 1.06,
      Vigo: 0.92,
      'Santiago de Compostela': 1.02,
      Palma: 1.18,
      Ibiza: 1.15,
      'Las Palmas': 1.22,
      Tenerife: 1.25,
      Málaga: 1.14,
      Granada: 1.04,
      Alicante: 0.85,
      Murcia: 0.82,
      Gijón: 1.08,
      Santander: 1.1,
      Pamplona: 1.05,
      Lanzarote: 1.2,
    },
  },
];

const MARKET_CITIES = Array.from(new Set(ZONES.map((z) => z.city)));

type ActionDef = {
  id: string;
  label: string;
  description: string;
  lifestyle: 'LEGAL' | 'GREY' | 'STREET';
  minLevel: number;
  risk: number;
  vibes: string[];
};

const ACTIONS: ActionDef[] = [
  {
    id: 'trabajo_legal',
    label: 'Currar en limpio',
    description: 'Un turno de trabajo legal. Poco riesgo, poco dinero.',
    lifestyle: 'LEGAL',
    minLevel: 1,
    risk: 0.05,
    vibes: ['business', 'luxury'],
  },
  {
    id: 'negocio_gris',
    label: 'Trato opaco',
    description: 'Favores, comisiones y sobres. La zona gris paga mejor.',
    lifestyle: 'GREY',
    minLevel: 1,
    risk: 0.2,
    vibes: ['business', 'nightlife', 'street', 'luxury'],
  },
  {
    id: 'reparto',
    label: 'Reparto exprés',
    description: 'Lleva un paquete de un punto a otro sin mirar dentro.',
    lifestyle: 'GREY',
    minLevel: 1,
    risk: 0.25,
    vibes: ['street', 'nightlife', 'business'],
  },
  {
    id: 'carterista',
    label: 'Mano larga',
    description: 'Turistas despistados. Si te pillan, sube el calor.',
    lifestyle: 'STREET',
    minLevel: 1,
    risk: 0.4,
    vibes: ['street', 'nightlife'],
  },
  {
    id: 'amenaza',
    label: 'Cobro de deuda',
    description: 'Alguien debe. Tú cobras. La reputación de calle sube… o te partes la cara.',
    lifestyle: 'STREET',
    minLevel: 3,
    risk: 0.35,
    vibes: ['street', 'nightlife'],
  },
  {
    id: 'networking',
    label: 'Hacer contactos',
    description: 'Copas, sonrisas y tarjetas. Abre puertas más adelante.',
    lifestyle: 'LEGAL',
    minLevel: 1,
    risk: 0.05,
    vibes: ['luxury', 'business', 'nightlife'],
  },
  {
    id: 'vip',
    label: 'Entrar en el VIP',
    description: 'Gastar para estar donde está el dinero real.',
    lifestyle: 'GREY',
    minLevel: 5,
    risk: 0.15,
    vibes: ['luxury', 'nightlife'],
  },
  {
    id: 'huir_calor',
    label: 'Enfriar el barrio',
    description: 'Mantén la cabeza baja. Baja el calor policial.',
    lifestyle: 'GREY',
    minLevel: 1,
    risk: 0,
    vibes: [],
  },
];

const AVATARS = [
  { id: 'runner', label: 'Corredor' },
  { id: 'fix', label: 'Fijo' },
  { id: 'shadow', label: 'Sombra' },
];

@Injectable()
export class WorldService {
  private readonly marketCargo = new Map<string, Record<MarketGoodId, number>>();

  constructor(
    private prisma: PrismaService,
    @Optional() private readonly antiCheat?: AntiCheatService,
  ) {}

  private async player(userId: string) {
    const p = await this.prisma.player.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException('Player not found');
    return p;
  }

  private assertNotJailed(jailUntil?: Date | null) {
    if (jailUntil && new Date(jailUntil).getTime() > Date.now()) {
      const remainingSec = Math.ceil(
        (new Date(jailUntil).getTime() - Date.now()) / 1000,
      );
      throw new ForbiddenException(
        `Estás en el calabozo (${remainingSec}s restantes). Espera a cumplir tu condena o paga la fianza.`,
      );
    }
  }

  getZoneInfo(locationId: string) {
    const vibe = ZONE_VIBES[locationId] || 'street';
    const actions = ACTIONS.filter(
      (a) => a.vibes.length === 0 || a.vibes.includes(vibe),
    );
    return { locationId, vibe, actions };
  }

  async getStreetState(userId: string) {
    const p = await this.player(userId);
    const loc = p.locationId || 'madrid_centro';
    const zone = this.getZoneInfo(loc);
    const activeMissions = await this.prisma.playerMission.findMany({
      where: {
        playerId: p.id,
        status: { in: ['IN_PROGRESS', 'PENDING'] },
      },
      include: { template: true },
      take: 5,
    });
    return {
      player: {
        id: p.id,
        displayName: p.displayName,
        level: p.level,
        xp: p.xp,
        euros: p.euros,
        vidaCoins: p.vidaCoins,
        reputation: p.reputation,
        heat: p.heat ?? 0,
        wantedLevel: p.wantedLevel ?? 0,
        faction: p.faction ?? 'CIVILIAN',
        factionRank: p.factionRank ?? 1,
        jailUntil: p.jailUntil ?? null,
        lifestyle: p.lifestyle ?? 'GREY',
        locationId: loc,
      },
      zone,
      activeMissions,
      avatars: AVATARS,
    };
  }

  async getMapState() {
    const territories = await this.prisma.territory.findMany({
      include: {
        controller: {
          select: { id: true, name: true, tag: true },
        },
      },
      orderBy: { city: 'asc' },
    });

    return {
      zones: ZONES,
      routes: HIGHWAY_ROUTES,
      territories,
    };
  }

  async travel(userId: string, destinationId: string) {
    if (!isValidZoneId(destinationId)) {
      throw new BadRequestException('Destino no válido');
    }

    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) {
        throw new NotFoundException('Player not found');
      }
      this.assertNotJailed(player.jailUntil);

      const fromId = player.locationId || 'madrid_centro';
      if (fromId === destinationId) {
        throw new BadRequestException('Ya te encuentras en esa zona');
      }

      const fromZone = ZONES_BY_ID[fromId] ?? ZONES_BY_ID['madrid_centro'];
      const toZone = ZONES_BY_ID[destinationId];
      const route = calculateRouteBetweenZones(fromZone.id, toZone.id);

      const primaryVehicle = await tx.playerVehicle.findFirst({
        where: { playerId: player.id },
        include: { template: true },
        orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
      });

      let durationSec: number;
      let baseCostEuros: number;
      let vehicleUsed: {
        mode: 'VEHICLE' | 'PUBLIC_TRANSPORT';
        id: string | null;
        name: string;
        brand: string | null;
        licensePlate: string | null;
        speed: number | null;
        condition: number | null;
      };

      const tollMultiplier = player.faction === 'NIGHT_RACING' ? 0.65 : 1;
      const effectiveToll = Math.round(route.tollEuros * tollMultiplier * 100) / 100;

      if (primaryVehicle) {
        const speed = Math.max(20, primaryVehicle.template.speed);
        const condition = Math.max(
          10,
          Math.min(100, primaryVehicle.condition ?? 100),
        );
        const racingSpeedBoost = player.faction === 'NIGHT_RACING' ? 1.15 : 1;
        const effectiveKmh =
          speed * 1.35 * racingSpeedBoost * (0.5 + 0.5 * (condition / 100));
        durationSec = Math.max(
          3,
          Math.round((route.distanceKm / effectiveKmh) * 60),
        );
        baseCostEuros = route.isIntercity
          ? Math.round(
              (route.distanceKm * 0.12 * (1 + (100 - condition) / 200) +
                effectiveToll) *
                100,
            ) / 100
          : Math.max(1, Math.round(route.distanceKm * 0.4 * 100) / 100);

        vehicleUsed = {
          mode: 'VEHICLE',
          id: primaryVehicle.id,
          name: primaryVehicle.template.name,
          brand: primaryVehicle.template.brand,
          licensePlate: primaryVehicle.licensePlate,
          speed: primaryVehicle.template.speed,
          condition,
        };
      } else {
        if (route.isIntercity) {
          durationSec = Math.max(
            15,
            Math.round((route.distanceKm / 80) * 60),
          );
          baseCostEuros = Math.max(
            15,
            Math.round(route.distanceKm * 0.18 * 100) / 100,
          );
        } else {
          durationSec = Math.max(8, Math.round(route.distanceKm * 6));
          baseCostEuros = 3;
        }

        vehicleUsed = {
          mode: 'PUBLIC_TRANSPORT',
          id: null,
          name: 'Transporte Público',
          brand: null,
          licensePlate: null,
          speed: null,
          condition: null,
        };
      }

      if (player.euros < baseCostEuros) {
        throw new BadRequestException(
          `No tienes suficientes euros para viajar (necesitas ${baseCostEuros}€)`,
        );
      }

      let totalCost = baseCostEuros;
      let newHeat = player.heat ?? 0;
      const narrativeParts: string[] = [
        `Viajas de ${fromZone.name} (${fromZone.city}) a ${toZone.name} (${toZone.city}) por ${route.highway} (${route.distanceKm} km) en ${vehicleUsed.name}.`,
      ];

      if (route.isIntercity && newHeat >= 50) {
        const evasionSpeedThreshold = player.faction === 'NIGHT_RACING' ? 70 : 80;
        if (primaryVehicle && primaryVehicle.template.speed >= evasionSpeedThreshold) {
          narrativeParts.push(
            `Control de la Guardia Civil en la ${route.highway}, pero tu ${primaryVehicle.template.name} acelera a fondo y logras evadirlo sin consecuencias.`,
          );
        } else {
          const checkpointTriggered = Math.random() < 0.65;
          if (checkpointTriggered) {
            const availableForFine = Math.max(0, player.euros - baseCostEuros);
            const rawFine = Math.round(40 + newHeat * 0.8);
            const fine = Math.min(
              Math.round(availableForFine * 100) / 100,
              rawFine,
            );
            const heatDelta = 5 + Math.floor(Math.random() * 6);
            newHeat = Math.min(100, newHeat + heatDelta);
            totalCost = Math.round((baseCostEuros + fine) * 100) / 100;
            narrativeParts.push(
              `Control de la Guardia Civil en la ${route.highway}: te paran y te cae una multa de ${fine}€ (+${heatDelta} calor).`,
            );
          } else {
            narrativeParts.push(
              `Avistas un control de la Guardia Civil en la ${route.highway}, pero logras pasar desapercibido.`,
            );
          }
        }
      }

      const newWantedLevel = Math.min(5, Math.floor(newHeat / 20));

      const updatedPlayer = await tx.player.update({
        where: { userId },
        data: {
          locationId: destinationId,
          euros: Math.max(0, Math.round((player.euros - totalCost) * 100) / 100),
          heat: newHeat,
          wantedLevel: newWantedLevel,
        },
      });

      return {
        from: fromZone,
        to: toZone,
        distanceKm: route.distanceKm,
        durationSec,
        costEuros: totalCost,
        highway: route.highway,
        vehicleUsed,
        narrative: narrativeParts.join(' '),
        player: {
          id: updatedPlayer.id,
          displayName: updatedPlayer.displayName,
          level: updatedPlayer.level,
          xp: updatedPlayer.xp,
          euros: updatedPlayer.euros,
          heat: updatedPlayer.heat,
          wantedLevel: updatedPlayer.wantedLevel,
          reputation: updatedPlayer.reputation,
          locationId: updatedPlayer.locationId,
        },
      };
    });
  }

  async setLifestyle(userId: string, lifestyle: 'LEGAL' | 'GREY' | 'STREET') {
    return this.prisma.player.update({
      where: { userId },
      data: { lifestyle },
    });
  }

  async performAction(userId: string, actionId: string) {
    const action = ACTIONS.find((a) => a.id === actionId);
    if (!action) throw new NotFoundException('Acción desconocida');

    return this.prisma.$transaction(async (tx) => {
      const p = await tx.player.findUnique({ where: { userId } });
      if (!p) throw new NotFoundException('Player not found');
      this.assertNotJailed(p.jailUntil);

      this.antiCheat?.assertActionCooldown(
        userId,
        'world_action',
        2000,
        'Espera un momento antes de realizar otra acción en la calle.',
      );

      if (p.level < action.minLevel) {
        throw new BadRequestException(`Necesitas nivel ${action.minLevel}`);
      }
      const loc = p.locationId || 'madrid_centro';
      const currentCity = ZONES_BY_ID[loc]?.city;
      const vibe = ZONE_VIBES[loc] || 'street';
      if (action.vibes.length && !action.vibes.includes(vibe)) {
        throw new BadRequestException('Esa movida no encaja en este barrio');
      }
      const heat = p.heat ?? 0;
      if (heat >= 90 && action.id !== 'huir_calor') {
        throw new BadRequestException(
          'El barrio está demasiado caliente. Enfría antes de seguir.',
        );
      }
      const failed = Math.random() < action.risk;
      let eurosDelta = 0;
      let xpDelta = 0;
      let repDelta = 0;
      let heatDelta = 0;
      let narrative = '';
      if (action.id === 'huir_calor') {
        heatDelta = -15 - Math.floor(Math.random() * 10);
        if (p.faction === 'ENTREPRENEUR' || p.faction === 'CYBER_HACKER') {
          heatDelta -= 5;
        }
        narrative = 'Te escondes y dejas pasar el ruido. El calor baja.';
        xpDelta = 5;
      } else if (failed) {
        heatDelta = 8 + Math.floor(Math.random() * 12);
        if (p.faction === 'CYBER_HACKER') {
          heatDelta = Math.max(4, Math.round(heatDelta * 0.7));
        }
        eurosDelta =
          action.lifestyle === 'STREET' ? -Math.floor(20 + Math.random() * 80) : 0;
        narrative = `La movida "${action.label}" se torció. El barrio te mira.`;
        xpDelta = 3;
      } else {
        const baseEuros = 30 + p.level * 5 + Math.floor(Math.random() * 40);
        let factionMultiplier = 1;
        if (p.faction === 'SYNDICATE' && action.lifestyle === 'STREET') {
          factionMultiplier = 1.15;
        } else if (p.faction === 'ENTREPRENEUR' && action.lifestyle === 'LEGAL') {
          factionMultiplier = 1.15;
        } else if (
          p.faction === 'CYBER_HACKER' &&
          (action.id === 'negocio_gris' || action.id === 'networking')
        ) {
          factionMultiplier = 1.15;
        } else if (
          p.faction === 'CARTEL_MARITIMO' &&
          (action.id === 'reparto' || action.id === 'amenaza')
        ) {
          factionMultiplier = 1.15;
        }
        eurosDelta = Math.round(baseEuros * factionMultiplier);
        xpDelta = 10 + Math.floor(Math.random() * 10);
        repDelta = action.lifestyle === 'STREET' ? 2 : 1;
        heatDelta = Math.floor(action.risk * 20);
        if (p.faction === 'CYBER_HACKER') {
          heatDelta = Math.floor(heatDelta * 0.7);
        }
        narrative = `"${action.label}" sale bien. +${eurosDelta}€`;
      }
      const newHeat = Math.max(0, Math.min(100, heat + heatDelta));
      const newWantedLevel = Math.min(5, Math.floor(newHeat / 20));
      const newXp = p.xp + xpDelta;
      const calculatedLevel = calculateLevelFromXp(newXp);
      const newLevel = calculatedLevel > p.level ? calculatedLevel : p.level;

      const updated = await tx.player.update({
        where: { userId },
        data: {
          euros: Math.max(0, p.euros + eurosDelta),
          xp: newXp,
          level: newLevel,
          reputation: p.reputation + repDelta,
          heat: newHeat,
          wantedLevel: newWantedLevel,
        },
      });
      if (!failed && action.id !== 'huir_calor') {
        const missions = await tx.playerMission.findMany({
          where: { playerId: p.id, status: 'IN_PROGRESS' },
          include: { template: true },
          take: 3,
        });
        for (const m of missions) {
          const tpl = m.template as
            | { mode?: string; city?: string | null; requiredSteps?: number }
            | undefined;
          // Online Co-op missions require explicit team advancement via /missions
          if (tpl?.mode === 'ONLINE_COOP') continue;
          if (tpl?.city && currentCity && tpl.city !== currentCity) continue;
          const steps = Math.max(1, tpl?.requiredSteps ?? 3);
          const stepPct = Math.max(5, Math.floor(100 / steps));
          const prog = Math.min(100, m.progress + stepPct);
          await tx.playerMission.update({
            where: { id: m.id },
            data: {
              progress: prog,
              status: prog >= 100 ? 'COMPLETED' : 'IN_PROGRESS',
              completedAt: prog >= 100 ? new Date() : undefined,
              lastStepAt: new Date(),
            },
          });
        }
      }
      return {
        ok: !failed,
        failed,
        actionId,
        narrative,
        deltas: { euros: eurosDelta, xp: xpDelta, reputation: repDelta, heat: heatDelta },
        player: {
          level: updated.level,
          xp: updated.xp,
          euros: updated.euros,
          heat: updated.heat,
          wantedLevel: updated.wantedLevel,
          reputation: updated.reputation,
        },
      };
    });
  }

  private getHourWindowBucket(now = Date.now()): number {
    return Math.floor(now / (60 * 60 * 1000));
  }

  private computeGoodPrice(
    good: MarketGoodDef,
    city: string,
    hourBucket: number,
  ): number {
    const cityBias = good.cityBias[city] ?? 1.0;
    const seedStr = `${city}:${good.id}:${hourBucket}`;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) | 0;
    }
    const normalized = Math.sin(hash) * 0.22; // -22% to +22% hourly fluctuation
    const price = good.basePrice * cityBias * (1 + normalized);
    return Math.max(10, Math.round(price * 100) / 100);
  }

  private getPlayerCargo(playerId: string): Record<MarketGoodId, number> {
    let cargo = this.marketCargo.get(playerId);
    if (!cargo) {
      cargo = {
        relojes_lujo: 0,
        tech_chips: 0,
        aceite_gourmet: 0,
        piezas_tuning: 0,
      };
      this.marketCargo.set(playerId, cargo);
    }
    return cargo;
  }

  async getMarket(userId: string) {
    const p = await this.player(userId);
    const zoneId = p.locationId || 'madrid_centro';
    const zone = ZONES_BY_ID[zoneId] ?? ZONES_BY_ID['madrid_centro'];
    const currentCity = zone.city;
    const now = Date.now();
    const hourBucket = this.getHourWindowBucket(now);
    const windowExpiresAt = new Date((hourBucket + 1) * 60 * 60 * 1000).toISOString();
    const cargo = this.getPlayerCargo(p.id);

    const goods = MARKET_GOODS.map((good) => {
      const cityPrices: Record<string, number> = {};
      for (const city of MARKET_CITIES) {
        cityPrices[city] = this.computeGoodPrice(good, city, hourBucket);
      }
      return {
        id: good.id,
        name: good.name,
        description: good.description,
        basePrice: good.basePrice,
        currentPrice: cityPrices[currentCity],
        owned: cargo[good.id] ?? 0,
        cityPrices,
      };
    });

    return {
      currentZoneId: zone.id,
      currentCity,
      hourWindow: hourBucket,
      windowExpiresAt,
      euros: p.euros,
      goods,
    };
  }

  async tradeMarket(userId: string, dto: MarketTradeDto) {
    const good = MARKET_GOODS.find((g) => g.id === dto.goodId);
    if (!good) {
      throw new BadRequestException('Bien comerciable no válido');
    }

    if (
      !Number.isInteger(dto.quantity) ||
      dto.quantity <= 0 ||
      dto.quantity > 1000
    ) {
      throw new BadRequestException(
        'La cantidad debe ser un entero entre 1 y 1000',
      );
    }
    this.antiCheat?.assertFinitePositive(dto.quantity, 'quantity', 1000);

    return this.prisma.$transaction(async (tx) => {
      const p = await tx.player.findUnique({ where: { userId } });
      if (!p) throw new NotFoundException('Player not found');
      this.assertNotJailed(p.jailUntil);

      const zoneId = p.locationId || 'madrid_centro';
      const zone = ZONES_BY_ID[zoneId] ?? ZONES_BY_ID['madrid_centro'];
      const city = zone.city;
      const hourBucket = this.getHourWindowBucket();
      const unitPrice = this.computeGoodPrice(good, city, hourBucket);
      const totalAmount = Math.round(unitPrice * dto.quantity * 100) / 100;
      const cargo = this.getPlayerCargo(p.id);

      if (dto.action === 'BUY') {
        const debit = await tx.player.updateMany({
          where: { id: p.id, euros: { gte: totalAmount } },
          data: { euros: { decrement: totalAmount } },
        });
        if (debit.count === 0) {
          throw new BadRequestException(
            `No tienes suficientes euros (necesitas ${totalAmount}€)`,
          );
        }

        cargo[dto.goodId] = (cargo[dto.goodId] ?? 0) + dto.quantity;

        await tx.transactionLog.create({
          data: {
            playerId: p.id,
            type: 'SPEND',
            amount: totalAmount,
            currency: 'EUR',
            reason: `Market BUY ${dto.quantity}x ${good.name} in ${city}`,
            reference: good.id,
          },
        });

        return {
          action: 'BUY',
          goodId: good.id,
          quantity: dto.quantity,
          unitPrice,
          totalAmount,
          city,
          owned: cargo[dto.goodId],
          euros: Math.round((p.euros - totalAmount) * 100) / 100,
        };
      }

      // SELL
      const currentOwned = cargo[dto.goodId] ?? 0;
      if (currentOwned < dto.quantity) {
        throw new BadRequestException(
          `No tienes suficientes unidades de ${good.name} (tienes ${currentOwned})`,
        );
      }

      cargo[dto.goodId] = currentOwned - dto.quantity;

      const updated = await tx.player.update({
        where: { id: p.id },
        data: { euros: { increment: totalAmount } },
      });

      await tx.transactionLog.create({
        data: {
          playerId: p.id,
          type: 'EARN',
          amount: totalAmount,
          currency: 'EUR',
          reason: `Market SELL ${dto.quantity}x ${good.name} in ${city}`,
          reference: good.id,
        },
      });

      return {
        action: 'SELL',
        goodId: good.id,
        quantity: dto.quantity,
        unitPrice,
        totalAmount,
        city,
        owned: cargo[dto.goodId],
        euros: updated.euros,
      };
    });
  }
}
