import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { FactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AntiCheatService } from '../security/anti-cheat.service';
import { calculateLevelFromXp } from '../common/utils/level.util';
import { toEuros } from '../common/utils/money.util';

export interface FactionCatalogItem {
  id: FactionType;
  name: string;
  description: string;
  perks: string[];
  requirements: {
    maxHeat?: number;
    notJailed?: boolean;
  };
}

const FACTION_CATALOG: FactionCatalogItem[] = [
  {
    id: FactionType.CIVILIAN,
    name: 'Ciudadano',
    description: 'Sin ataduras ni placa. Muévete libre por la ciudad.',
    perks: ['Sin restricciones de zona', 'Cambio de facción inmediato'],
    requirements: {},
  },
  {
    id: FactionType.POLICE,
    name: 'Policía Nacional',
    description: 'Cuerpo urbano encargado de mantener el orden en las calles.',
    perks: [
      'Acceso a Interceptar sospechosos en ciudad',
      'Recompensas en € y XP por captura',
      'Insignia de autoridad local',
    ],
    requirements: { maxHeat: 0, notJailed: true },
  },
  {
    id: FactionType.GUARDIA_CIVIL,
    name: 'Guardia Civil',
    description: 'Patrulla de carreteras y control interurbano de alto nivel.',
    perks: [
      'Acceso a Interceptar sospechosos en todas las zonas',
      'Bonificación en persecuciones de alta velocidad',
      'Recompensas en € y XP por captura',
    ],
    requirements: { maxHeat: 0, notJailed: true },
  },
  {
    id: FactionType.SYNDICATE,
    name: 'Sindicato Callejero',
    description: 'Red clandestina de contrabando, robos y favores oscuros.',
    perks: [
      'Mayor reputación en golpes callejeros',
      'Prestigio al evadir persecuciones',
    ],
    requirements: {},
  },
  {
    id: FactionType.ENTREPRENEUR,
    name: 'Empresario',
    description: 'Élite financiera orientada a propiedades, clubes y negocios.',
    perks: [
      '+15% de rendimiento en alquileres y acciones legales',
      'Perfil limpio ante controles',
      'Sinergia con inversiones y rentas',
    ],
    requirements: {},
  },
  {
    id: FactionType.ERTZAINTZA_MOSSOS,
    name: 'Fuerzas Autonómicas',
    description:
      "Unidades tácticas de Ertzaintza y Mossos d'Esquadra con despliegue rápido regional.",
    perks: [
      'Acceso a Interceptar sospechosos en tu zona',
      'Despliegue ágil entre País Vasco, Navarra y Cataluña',
      'Recompensas en € y XP por captura',
    ],
    requirements: { maxHeat: 0, notJailed: true },
  },
  {
    id: FactionType.CYBER_HACKER,
    name: 'Colectivo ShadowNet',
    description:
      'Red de hackers, infiltradores digitales y operadores fantasma sin huella.',
    perks: [
      '-30% de calor policial generado en golpes y tratos grises',
      '+5% de éxito adicional en golpes cooperativos',
      '+15% de recompensa en operaciones digitales y contactos',
    ],
    requirements: {},
  },
  {
    id: FactionType.CARTEL_MARITIMO,
    name: 'Hermandad Portuaria',
    description:
      'Sindicato marítimo de Galicia, Levante, Baleares y Canarias experto en descargas y puertos.',
    perks: [
      '+15% de botín en repartos y comercio marítimo en ciudades costeras',
      'Ventaja en rutas de ferry y descargas nocturnas',
      '+10% de botín en golpes portuarios',
    ],
    requirements: {},
  },
  {
    id: FactionType.NIGHT_RACING,
    name: 'Club Nocturno Apex',
    description:
      'Escudería clandestina de autopistas, drift de montaña y fugas a 300 km/h.',
    perks: [
      '-35% en peajes de autopistas y autovías',
      'Evasión mejorada en controles de carretera con vehículos rápidos',
      'Mayor velocidad efectiva en rutas interurbanas',
    ],
    requirements: {},
  },
];

const LAW_ENFORCEMENT_FACTIONS: FactionType[] = [
  FactionType.POLICE,
  FactionType.GUARDIA_CIVIL,
  FactionType.ERTZAINTZA_MOSSOS,
];

@Injectable()
export class FactionsService {
  private static readonly AGENT_INTERCEPT_COOLDOWN_MS = 15_000;
  private static readonly SUSPECT_IMMUNITY_MS = 5 * 60 * 1000;
  private static readonly PAIR_WINDOW_MS = 20 * 60 * 1000;
  private static readonly PAIR_MAX_ATTEMPTS = 3;

  private readonly lastInterceptionByAgent = new Map<string, number>();
  private readonly suspectImmunityUntil = new Map<string, number>();
  private readonly pairInterceptions = new Map<string, number[]>();

  constructor(
    private prisma: PrismaService,
    @Optional() private realtimeGateway?: RealtimeGateway,
    @Optional() private antiCheat?: AntiCheatService,
  ) {}

  async getCatalog() {
    const counts = await this.prisma.player.groupBy({
      by: ['faction'],
      where: { isOnline: true },
      _count: { _all: true },
    });

    const countMap = new Map<FactionType, number>();
    for (const row of counts) {
      countMap.set(row.faction, row._count._all);
    }

    return FACTION_CATALOG.map((item) => ({
      ...item,
      activeMembers: countMap.get(item.id) ?? 0,
    }));
  }

  async joinFaction(userId: string, faction: FactionType) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    if (player.faction === faction) {
      throw new BadRequestException('Ya perteneces a esta facción');
    }

    const now = new Date();
    if (LAW_ENFORCEMENT_FACTIONS.includes(faction)) {
      if (player.jailUntil && new Date(player.jailUntil) > now) {
        throw new ForbiddenException(
          'No puedes unirte a las fuerzas del orden estando en el calabozo',
        );
      }
      if ((player.heat ?? 0) > 0) {
        throw new BadRequestException(
          'Debes tener calor policial en 0 para unirte a las fuerzas del orden',
        );
      }
    }

    const updated = await this.prisma.player.update({
      where: { userId },
      data: {
        faction,
        factionRank: 1,
      },
    });

    return {
      playerId: updated.id,
      displayName: updated.displayName,
      faction: updated.faction,
      factionRank: updated.factionRank,
    };
  }

  async getWantedPlayers() {
    const now = new Date();
    const suspects = await this.prisma.player.findMany({
      where: {
        heat: { gte: 40 },
        OR: [{ jailUntil: null }, { jailUntil: { lte: now } }],
      },
      orderBy: [{ heat: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        displayName: true,
        locationId: true,
        heat: true,
        wantedLevel: true,
      },
    });

    return suspects.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      locationId: s.locationId || 'madrid_centro',
      heat: s.heat,
      wantedLevel: Math.max(
        2,
        s.wantedLevel || Math.min(5, Math.floor(s.heat / 20)),
      ),
      bountyEuros: Math.round(75 + s.heat * 2.5),
    }));
  }

  async interceptSuspect(userId: string, suspectPlayerId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const agent = await tx.player.findUnique({
        where: { userId },
        include: {
          vehicles: {
            include: { template: true },
            orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
            take: 1,
          },
        },
      });
      if (!agent) {
        throw new NotFoundException('Player not found');
      }

      if (!LAW_ENFORCEMENT_FACTIONS.includes(agent.faction)) {
        throw new ForbiddenException(
          'Solo las fuerzas del orden (Policía, Guardia Civil o Autonómicas) pueden interceptar sospechosos',
        );
      }

      if (agent.jailUntil && new Date(agent.jailUntil) > now) {
        throw new ForbiddenException(
          'No puedes interceptar mientras estás en el calabozo',
        );
      }

      if (agent.id === suspectPlayerId) {
        throw new BadRequestException('No puedes interceptarte a ti mismo');
      }

      const suspect = await tx.player.findUnique({
        where: { id: suspectPlayerId },
        include: {
          vehicles: {
            include: { template: true },
            orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
            take: 1,
          },
        },
      });
      if (!suspect) {
        throw new NotFoundException('Sospechoso no encontrado');
      }

      const agentLoc = agent.locationId || 'madrid_centro';
      const suspectLoc = suspect.locationId || 'madrid_centro';
      if (agentLoc !== suspectLoc) {
        throw new BadRequestException(
          'Debes estar en la misma zona que el sospechoso para interceptarlo',
        );
      }

      if (suspect.jailUntil && new Date(suspect.jailUntil) > now) {
        throw new BadRequestException('El sospechoso ya está en el calabozo');
      }

      if ((suspect.heat ?? 0) < 40) {
        throw new BadRequestException(
          'El sospechoso no tiene suficiente calor policial (mínimo 40)',
        );
      }

      const nowMs = now.getTime();
      const pairKey = `${agent.id}:${suspect.id}`;
      const recentPairAttempts = (
        this.pairInterceptions.get(pairKey) ?? []
      ).filter((ts) => nowMs - ts < FactionsService.PAIR_WINDOW_MS);

      if (recentPairAttempts.length >= FactionsService.PAIR_MAX_ATTEMPTS) {
        await this.antiCheat?.recordViolation({
          userId,
          playerId: agent.id,
          rule: 'ECONOMY_TAMPER',
          severity: 'HIGH',
          evidence: {
            reason: 'police_win_trading',
            suspectPlayerId: suspect.id,
            attemptsInWindow: recentPairAttempts.length,
          },
        });
        throw new ForbiddenException(
          'Protección anti-abuso: límite de intercepciones repetidas contra este sospechoso alcanzado.',
        );
      }

      const immuneUntil = this.suspectImmunityUntil.get(suspect.id) ?? 0;
      if (immuneUntil > nowMs) {
        const waitSec = Math.ceil((immuneUntil - nowMs) / 1000);
        throw new BadRequestException(
          `El sospechoso tiene inmunidad anti-camping temporal tras una persecución reciente (${waitSec}s).`,
        );
      }

      const lastAgentAttempt = this.lastInterceptionByAgent.get(agent.id) ?? 0;
      if (
        lastAgentAttempt > 0 &&
        nowMs - lastAgentAttempt < FactionsService.AGENT_INTERCEPT_COOLDOWN_MS
      ) {
        const waitSec = Math.ceil(
          (FactionsService.AGENT_INTERCEPT_COOLDOWN_MS -
            (nowMs - lastAgentAttempt)) /
            1000,
        );
        throw new BadRequestException(
          `Enfriamiento policial activo entre intercepciones (${waitSec}s).`,
        );
      }

      this.lastInterceptionByAgent.set(agent.id, nowMs);
      this.suspectImmunityUntil.set(
        suspect.id,
        nowMs + FactionsService.SUSPECT_IMMUNITY_MS,
      );
      recentPairAttempts.push(nowMs);
      this.pairInterceptions.set(pairKey, recentPairAttempts);

      const agentSpeed = agent.vehicles?.[0]?.template?.speed ?? 65;
      const suspectSpeed = suspect.vehicles?.[0]?.template?.speed ?? 55;
      const speedAdvantage = (agentSpeed - suspectSpeed) * 0.005;
      const heatFactor = (suspect.heat - 40) * 0.002;
      const factionCaptureBonus =
        agent.faction === FactionType.GUARDIA_CIVIL
          ? 0.15
          : agent.faction === FactionType.ERTZAINTZA_MOSSOS
            ? 0.1
            : 0;
      const captureChance = Math.max(
        0.15,
        Math.min(
          0.95,
          0.55 + speedAdvantage + heatFactor + factionCaptureBonus,
        ),
      );
      const captured = Math.random() < captureChance;

      if (captured) {
        const jailUntil = new Date(now.getTime() + 90 * 1000);
        const fine = Math.round(100 + suspect.heat * 3);
        const baseBounty = Math.round(75 + suspect.heat * 2.5);
        const bountyEuros =
          agent.faction === FactionType.GUARDIA_CIVIL
            ? Math.round(baseBounty * 1.2)
            : baseBounty;
        const agentXpGain = 35 + Math.floor(suspect.heat * 0.5);

        const deductRes = await tx.player.updateMany({
          where: { id: suspect.id, euros: { gte: fine } },
          data: {
            euros: { decrement: fine },
            heat: 0,
            wantedLevel: 0,
            jailUntil,
          },
        });

        let appliedFine = fine;
        if (deductRes.count === 0) {
          appliedFine = Math.max(
            0,
            Math.round(toEuros(suspect.euros) * 100) / 100,
          );
          await tx.player.update({
            where: { id: suspect.id },
            data: {
              euros: 0,
              heat: 0,
              wantedLevel: 0,
              jailUntil,
            },
          });
        }

        const newAgentXp = agent.xp + agentXpGain;
        const newAgentLevel = Math.max(
          agent.level,
          calculateLevelFromXp(newAgentXp),
        );

        const updatedAgent = await tx.player.update({
          where: { id: agent.id },
          data: {
            euros: { increment: bountyEuros },
            xp: newAgentXp,
            level: newAgentLevel,
          },
        });

        return {
          captured: true,
          outcome: 'CAPTURED' as const,
          locationId: agentLoc,
          captureChance: Math.round(captureChance * 100) / 100,
          fineEuros: appliedFine,
          bountyEuros,
          agentXpGain,
          jailUntil,
          agent: {
            id: updatedAgent.id,
            displayName: updatedAgent.displayName,
            euros: updatedAgent.euros,
            xp: updatedAgent.xp,
            level: updatedAgent.level,
          },
          suspect: {
            id: suspect.id,
            displayName: suspect.displayName,
            heat: 0,
            wantedLevel: 0,
            jailUntil,
          },
        };
      } else {
        const newSuspectHeat = Math.min(100, suspect.heat + 10);
        const newSuspectWanted = Math.min(5, Math.floor(newSuspectHeat / 20));
        const suspectRepGain =
          suspect.faction === FactionType.SYNDICATE ? 10 : 5;
        const agentXpGain = 12;

        await tx.player.update({
          where: { id: suspect.id },
          data: {
            reputation: { increment: suspectRepGain },
            heat: newSuspectHeat,
            wantedLevel: newSuspectWanted,
          },
        });

        const newAgentXp = agent.xp + agentXpGain;
        const newAgentLevel = Math.max(
          agent.level,
          calculateLevelFromXp(newAgentXp),
        );

        const updatedAgent = await tx.player.update({
          where: { id: agent.id },
          data: {
            xp: newAgentXp,
            level: newAgentLevel,
          },
        });

        return {
          captured: false,
          outcome: 'ESCAPED' as const,
          locationId: agentLoc,
          captureChance: Math.round(captureChance * 100) / 100,
          suspectRepGain,
          agentXpGain,
          agent: {
            id: updatedAgent.id,
            displayName: updatedAgent.displayName,
            euros: updatedAgent.euros,
            xp: updatedAgent.xp,
            level: updatedAgent.level,
          },
          suspect: {
            id: suspect.id,
            displayName: suspect.displayName,
            heat: newSuspectHeat,
            wantedLevel: newSuspectWanted,
          },
        };
      }
    });

    this.realtimeGateway?.emitPursuitEvent(result.locationId, {
      outcome: result.outcome,
      captured: result.captured,
      agent: result.agent,
      suspect: result.suspect,
      bountyEuros: 'bountyEuros' in result ? result.bountyEuros : 0,
      fineEuros: 'fineEuros' in result ? result.fineEuros : 0,
    });

    return result;
  }

  async payBail(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const now = new Date();
    if (!player.jailUntil || new Date(player.jailUntil) <= now) {
      throw new BadRequestException('No estás en el calabozo');
    }

    const remainingSec = Math.ceil(
      (new Date(player.jailUntil).getTime() - now.getTime()) / 1000,
    );
    const rawBailCost = Math.max(50, remainingSec * 3);
    const syndicateDiscount = player.faction === FactionType.SYNDICATE;
    const bailCost = syndicateDiscount
      ? Math.max(35, Math.round(rawBailCost * 0.75))
      : rawBailCost;

    const res = await this.prisma.player.updateMany({
      where: {
        id: player.id,
        euros: { gte: bailCost },
        jailUntil: { gt: now },
      },
      data: {
        euros: { decrement: bailCost },
        jailUntil: null,
      },
    });

    if (res.count === 0) {
      throw new BadRequestException(
        `No tienes suficientes euros para pagar la fianza (${bailCost}€)`,
      );
    }

    return {
      released: true,
      bailCost,
      syndicateDiscount,
      eurosRemaining:
        Math.round((toEuros(player.euros) - bailCost) * 100) / 100,
      jailUntil: null,
    };
  }
}
