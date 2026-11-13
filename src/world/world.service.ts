import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
  constructor(private prisma: PrismaService) {}

  private async player(userId: string) {
    const p = await this.prisma.player.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException('Player not found');
    return p;
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

      if (primaryVehicle) {
        const speed = Math.max(20, primaryVehicle.template.speed);
        const condition = Math.max(
          10,
          Math.min(100, primaryVehicle.condition ?? 100),
        );
        const effectiveKmh = speed * 1.35 * (0.5 + 0.5 * (condition / 100));
        durationSec = Math.max(
          3,
          Math.round((route.distanceKm / effectiveKmh) * 60),
        );
        baseCostEuros = route.isIntercity
          ? Math.round(
              (route.distanceKm * 0.12 * (1 + (100 - condition) / 200) +
                route.tollEuros) *
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
        if (primaryVehicle && primaryVehicle.template.speed >= 80) {
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

      const updatedPlayer = await tx.player.update({
        where: { userId },
        data: {
          locationId: destinationId,
          euros: Math.max(0, Math.round((player.euros - totalCost) * 100) / 100),
          heat: newHeat,
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

      if (p.level < action.minLevel) {
        throw new BadRequestException(`Necesitas nivel ${action.minLevel}`);
      }
      const loc = p.locationId || 'madrid_centro';
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
        narrative = 'Te escondes y dejas pasar el ruido. El calor baja.';
        xpDelta = 5;
      } else if (failed) {
        heatDelta = 8 + Math.floor(Math.random() * 12);
        eurosDelta =
          action.lifestyle === 'STREET' ? -Math.floor(20 + Math.random() * 80) : 0;
        narrative = `La movida "${action.label}" se torció. El barrio te mira.`;
        xpDelta = 3;
      } else {
        eurosDelta = 30 + p.level * 5 + Math.floor(Math.random() * 40);
        xpDelta = 10 + Math.floor(Math.random() * 10);
        repDelta = action.lifestyle === 'STREET' ? 2 : 1;
        heatDelta = Math.floor(action.risk * 20);
        narrative = `"${action.label}" sale bien. +${eurosDelta}€`;
      }
      const newHeat = Math.max(0, Math.min(100, heat + heatDelta));
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
        },
      });
      const missions = await tx.playerMission.findMany({
        where: { playerId: p.id, status: 'IN_PROGRESS' },
        take: 3,
      });
      for (const m of missions) {
        const prog = Math.min(100, m.progress + 20 + Math.floor(Math.random() * 15));
        await tx.playerMission.update({
          where: { id: m.id },
          data: {
            progress: prog,
            status: prog >= 100 ? 'COMPLETED' : 'IN_PROGRESS',
            completedAt: prog >= 100 ? new Date() : undefined,
          },
        });
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
          reputation: updated.reputation,
        },
      };
    });
  }
}
