import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Acciones de calle por vibe de zona – mundo libre */
const ZONE_VIBES: Record<string, string> = {
  madrid_centro: 'business',
  malasana: 'nightlife',
  salamanca: 'luxury',
  barcelona_ramblas: 'street',
  barcelona_gotico: 'street',
  marbella_centro: 'luxury',
  puerto_banus: 'luxury',
  sevilla_casco: 'street',
  valencia_artes: 'business',
  bilbao_casco: 'street',
};

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
    const loc = (p as any).locationId || 'madrid_centro';
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
        heat: (p as any).heat ?? 0,
        lifestyle: (p as any).lifestyle ?? 'GREY',
        locationId: loc,
      },
      zone,
      activeMissions,
      avatars: AVATARS,
    };
  }

  async setLifestyle(userId: string, lifestyle: 'LEGAL' | 'GREY' | 'STREET') {
    return this.prisma.player.update({
      where: { userId },
      data: { lifestyle } as any,
    });
  }

  async performAction(userId: string, actionId: string) {
    const p = await this.player(userId);
    const action = ACTIONS.find((a) => a.id === actionId);
    if (!action) throw new NotFoundException('Acción desconocida');
    if (p.level < action.minLevel) {
      throw new BadRequestException(`Necesitas nivel ${action.minLevel}`);
    }
    const loc = (p as any).locationId || 'madrid_centro';
    const vibe = ZONE_VIBES[loc] || 'street';
    if (action.vibes.length && !action.vibes.includes(vibe)) {
      throw new BadRequestException('Esa movida no encaja en este barrio');
    }
    let heat = (p as any).heat ?? 0;
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
    let newXp = p.xp + xpDelta;
    let newLevel = p.level;
    while (newXp >= newLevel * 100) {
      newXp -= newLevel * 100;
      newLevel += 1;
    }
    const updated = await this.prisma.player.update({
      where: { userId },
      data: {
        euros: Math.max(0, p.euros + eurosDelta),
        xp: newXp,
        level: newLevel,
        reputation: p.reputation + repDelta,
        heat: newHeat,
      } as any,
    });
    const missions = await this.prisma.playerMission.findMany({
      where: { playerId: p.id, status: 'IN_PROGRESS' },
      take: 3,
    });
    for (const m of missions) {
      const prog = Math.min(100, m.progress + 20 + Math.floor(Math.random() * 15));
      await this.prisma.playerMission.update({
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
        heat: (updated as any).heat,
        reputation: updated.reputation,
      },
    };
  }
}
