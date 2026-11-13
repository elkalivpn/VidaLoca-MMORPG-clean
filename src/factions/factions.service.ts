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
import { calculateLevelFromXp } from '../common/utils/level.util';

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
      'Acceso a /intercept en ciudad',
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
      'Acceso a /intercept en todas las zonas',
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
      'Perfil limpio ante controles',
      'Sinergia con inversiones y rentas',
    ],
    requirements: {},
  },
];

const LAW_ENFORCEMENT_FACTIONS: FactionType[] = [
  FactionType.POLICE,
  FactionType.GUARDIA_CIVIL,
];

@Injectable()
export class FactionsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private realtimeGateway?: RealtimeGateway,
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
          'Debes tener calor policial en 0 para unirte a Policía o Guardia Civil',
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
      wantedLevel: Math.max(2, s.wantedLevel || Math.min(5, Math.floor(s.heat / 20))),
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
          'Solo Policía o Guardia Civil pueden interceptar sospechosos',
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

      const agentSpeed = agent.vehicles?.[0]?.template?.speed ?? 65;
      const suspectSpeed = suspect.vehicles?.[0]?.template?.speed ?? 55;
      const speedAdvantage = (agentSpeed - suspectSpeed) * 0.005;
      const heatFactor = (suspect.heat - 40) * 0.002;
      const captureChance = Math.max(
        0.15,
        Math.min(0.92, 0.55 + speedAdvantage + heatFactor),
      );
      const captured = Math.random() < captureChance;

      if (captured) {
        const jailUntil = new Date(now.getTime() + 90 * 1000);
        const fine = Math.round(100 + suspect.heat * 3);
        const bountyEuros = Math.round(75 + suspect.heat * 2.5);
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
          appliedFine = Math.max(0, Math.round(suspect.euros * 100) / 100);
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
        const suspectRepGain = 5;
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
    const bailCost = Math.max(50, remainingSec * 3);

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
      eurosRemaining: Math.round((player.euros - bailCost) * 100) / 100,
      jailUntil: null,
    };
  }
}
