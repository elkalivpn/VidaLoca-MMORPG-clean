import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { calculateLevelFromXp } from '../common/utils/level.util';
import { CreateHeistDto, HeistRole, JoinHeistDto } from './dto/heists.dto';
import { AntiCheatService } from '../security/anti-cheat.service';

export interface HeistCatalogItem {
  id: string;
  name: string;
  city: string;
  zoneId: string;
  description: string;
  difficulty: 'MEDIUM' | 'HARD' | 'SUICIDE';
  minLevel: number;
  minCrew: number;
  maxCrew: number;
  rewardEuros: number;
  rewardDirtyEuros: number;
  rewardXp: number;
  baseHeat: number;
  baseSuccessChance: number;
}

export interface HeistParticipant {
  playerId: string;
  userId: string;
  displayName: string;
  role: HeistRole;
  joinedAt: string;
}

export interface HeistLobby {
  id: string;
  heistId: string;
  heistName: string;
  zoneId: string;
  leaderPlayerId: string;
  status: 'OPEN' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  participants: HeistParticipant[];
  createdAt: string;
  executedAt?: string;
}

export const HEIST_CATALOG: HeistCatalogItem[] = [
  {
    id: 'blindado_castellana',
    name: 'Golpe al Blindado de Castellana',
    city: 'Madrid',
    zoneId: 'madrid_centro',
    description:
      'Intercepta un furgón blindado en pleno Paseo de la Castellana antes de que llegue al Banco de España.',
    difficulty: 'MEDIUM',
    minLevel: 1,
    minCrew: 1,
    maxCrew: 3,
    rewardEuros: 1200,
    rewardDirtyEuros: 2500,
    rewardXp: 250,
    baseHeat: 25,
    baseSuccessChance: 0.72,
  },
  {
    id: 'yate_puerto_banus',
    name: 'Atraco al Yate de Puerto Banús',
    city: 'Marbella',
    zoneId: 'puerto_banus',
    description:
      'Asalta la caja fuerte de un megayate oligarca fondeado en Puerto Banús durante la fiesta privada.',
    difficulty: 'HARD',
    minLevel: 3,
    minCrew: 2,
    maxCrew: 3,
    rewardEuros: 2000,
    rewardDirtyEuros: 5000,
    rewardXp: 450,
    baseHeat: 35,
    baseSuccessChance: 0.65,
  },
  {
    id: 'puerto_barcelona',
    name: 'Asalto al Puerto de Barcelona',
    city: 'Barcelona',
    zoneId: 'barcelona_ramblas',
    description:
      'Desvía un contenedor de alta seguridad en la terminal de mercancías del Puerto de Barcelona.',
    difficulty: 'SUICIDE',
    minLevel: 5,
    minCrew: 2,
    maxCrew: 3,
    rewardEuros: 3500,
    rewardDirtyEuros: 8500,
    rewardXp: 700,
    baseHeat: 45,
    baseSuccessChance: 0.58,
  },
  {
    id: 'descarga_ria_vigo',
    name: 'Operación Ría de Vigo',
    city: 'Vigo',
    zoneId: 'vigo_puerto',
    description:
      'Intercepta una planeadora furtiva entre las Islas Cíes y los muelles de Vigo antes del amanecer.',
    difficulty: 'HARD',
    minLevel: 6,
    minCrew: 2,
    maxCrew: 3,
    rewardEuros: 2600,
    rewardDirtyEuros: 6200,
    rewardXp: 520,
    baseHeat: 38,
    baseSuccessChance: 0.63,
  },
  {
    id: 'banca_abando_bilbao',
    name: 'Bóveda de Gran Vía Bilbao',
    city: 'Bilbao',
    zoneId: 'bilbao_abando',
    description:
      'Golpe silencioso a la cámara acorazada del distrito financiero de Abando durante el cambio de turno.',
    difficulty: 'HARD',
    minLevel: 8,
    minCrew: 2,
    maxCrew: 3,
    rewardEuros: 3100,
    rewardDirtyEuros: 6800,
    rewardXp: 600,
    baseHeat: 40,
    baseSuccessChance: 0.6,
  },
  {
    id: 'casino_palma_maritimo',
    name: 'Noche en el Paseo Marítimo',
    city: 'Palma',
    zoneId: 'palma_paseo',
    description:
      'Extrae la recaudación VIP del club náutico privado de Palma y huye en lancha rápida por la bahía.',
    difficulty: 'SUICIDE',
    minLevel: 12,
    minCrew: 2,
    maxCrew: 3,
    rewardEuros: 4500,
    rewardDirtyEuros: 10500,
    rewardXp: 850,
    baseHeat: 48,
    baseSuccessChance: 0.56,
  },
  {
    id: 'muelle_canarias_atlantico',
    name: 'Convoy Atlántico en La Luz',
    city: 'Las Palmas',
    zoneId: 'laspalmas_canteras',
    description:
      'Operación internacional en la zona franca portuaria de Gran Canaria con cobertura de equipo completo.',
    difficulty: 'SUICIDE',
    minLevel: 15,
    minCrew: 2,
    maxCrew: 3,
    rewardEuros: 5600,
    rewardDirtyEuros: 12500,
    rewardXp: 1050,
    baseHeat: 52,
    baseSuccessChance: 0.54,
  },
];

@Injectable()
export class HeistsService {
  private readonly lobbies = new Map<string, HeistLobby>();

  constructor(
    private prisma: PrismaService,
    @Optional() private readonly antiCheat?: AntiCheatService,
  ) {}

  private assertNotJailed(jailUntil?: Date | null) {
    if (jailUntil && new Date(jailUntil).getTime() > Date.now()) {
      const remainingSec = Math.ceil(
        (new Date(jailUntil).getTime() - Date.now()) / 1000,
      );
      throw new ForbiddenException(
        `Estás en el calabozo (${remainingSec}s restantes). No puedes participar en golpes.`,
      );
    }
  }

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }

  getCatalogAndLobbies() {
    const activeLobbies = Array.from(this.lobbies.values()).filter(
      (l) => l.status === 'OPEN',
    );
    return {
      catalog: HEIST_CATALOG,
      activeLobbies,
    };
  }

  async createLobby(userId: string, dto: CreateHeistDto) {
    const heist = HEIST_CATALOG.find((h) => h.id === dto.heistId);
    if (!heist) {
      throw new NotFoundException(`Golpe desconocido: ${dto.heistId}`);
    }

    const player = await this.getPlayerOrThrow(userId);
    this.assertNotJailed(player.jailUntil);

    if (player.level < heist.minLevel) {
      throw new BadRequestException(
        `Necesitas nivel ${heist.minLevel} para liderar "${heist.name}"`,
      );
    }

    const alreadyInLobby = Array.from(this.lobbies.values()).find(
      (l) =>
        l.status === 'OPEN' &&
        l.participants.some((p) => p.playerId === player.id),
    );
    if (alreadyInLobby) {
      throw new BadRequestException(
        'Ya formas parte de un lobby de golpe activo',
      );
    }

    const role: HeistRole = dto.role ?? 'DRIVER';
    const zoneId = player.locationId || 'madrid_centro';
    const lobby: HeistLobby = {
      id: randomUUID(),
      heistId: heist.id,
      heistName: heist.name,
      zoneId,
      leaderPlayerId: player.id,
      status: 'OPEN',
      participants: [
        {
          playerId: player.id,
          userId: player.userId,
          displayName: player.displayName,
          role,
          joinedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    this.lobbies.set(lobby.id, lobby);
    return lobby;
  }

  async joinLobby(userId: string, lobbyId: string, dto: JoinHeistDto) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new NotFoundException('Lobby de golpe no encontrado');
    }
    if (lobby.status !== 'OPEN') {
      throw new BadRequestException('Este lobby ya no está abierto');
    }

    const heist = HEIST_CATALOG.find((h) => h.id === lobby.heistId);
    if (!heist) {
      throw new NotFoundException('Golpe no encontrado');
    }

    const player = await this.getPlayerOrThrow(userId);
    this.assertNotJailed(player.jailUntil);

    const playerZone = player.locationId || 'madrid_centro';
    if (playerZone !== lobby.zoneId) {
      throw new BadRequestException(
        `Debes estar en la zona ${lobby.zoneId} para unirte a este golpe`,
      );
    }

    if (lobby.participants.some((p) => p.playerId === player.id)) {
      throw new BadRequestException('Ya estás en este lobby');
    }

    if (lobby.participants.length >= heist.maxCrew) {
      throw new BadRequestException('El lobby ya está completo');
    }

    if (lobby.participants.some((p) => p.role === dto.role)) {
      throw new BadRequestException(
        `El rol ${dto.role} ya está ocupado en este lobby`,
      );
    }

    lobby.participants.push({
      playerId: player.id,
      userId: player.userId,
      displayName: player.displayName,
      role: dto.role,
      joinedAt: new Date().toISOString(),
    });

    return lobby;
  }

  async executeLobby(userId: string, lobbyId: string) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new NotFoundException('Lobby de golpe no encontrado');
    }
    if (lobby.status !== 'OPEN') {
      throw new BadRequestException('Este golpe ya ha sido ejecutado o está en curso');
    }

    const heist = HEIST_CATALOG.find((h) => h.id === lobby.heistId);
    if (!heist) {
      throw new NotFoundException('Golpe no encontrado');
    }

    // Synchronous lock before any await to prevent concurrent double-reward race conditions
    lobby.status = 'EXECUTING';

    try {
      this.antiCheat?.assertActionCooldown(
        userId,
        'heist_execute',
        60_000,
        'Debes esperar tras ejecutar un golpe antes de intentar otro.',
      );

      const caller = await this.getPlayerOrThrow(userId);
      const isParticipant = lobby.participants.some(
        (p) => p.playerId === caller.id,
      );
      if (!isParticipant) {
        throw new ForbiddenException(
          'No formas parte de este lobby de golpe',
        );
      }

      if (lobby.participants.length < heist.minCrew) {
        throw new BadRequestException(
          `Se necesitan al menos ${heist.minCrew} participantes para ejecutar "${heist.name}"`,
        );
      }

      const crewCount = lobby.participants.length;
      const uniqueRoles = new Set(lobby.participants.map((p) => p.role));
      const hasDriver = uniqueRoles.has('DRIVER');
      const hasHacker = uniqueRoles.has('HACKER');
      const hasEnforcer = uniqueRoles.has('ENFORCER');

      const successChance = Math.min(
        0.95,
        heist.baseSuccessChance +
          (crewCount - 1) * 0.08 +
          (hasHacker ? 0.05 : 0),
      );
      const succeeded = Math.random() < successChance;

      const result = await this.prisma.$transaction(async (tx) => {
        const participantIds = lobby.participants.map((p) => p.playerId);
        const players = await tx.player.findMany({
          where: { id: { in: participantIds } },
        });

        if (players.length !== participantIds.length) {
          throw new NotFoundException('Uno o más participantes no existen');
        }

        for (const p of players) {
          this.assertNotJailed(p.jailUntil);
        }

        const eurosMultiplier = hasEnforcer ? 1.1 : 1.0;
        const heatReduction = hasDriver ? 5 : 0;

        const totalCleanEuros = succeeded
          ? Math.round(heist.rewardEuros * eurosMultiplier * 100) / 100
          : 0;
        const totalDirtyEuros = succeeded
          ? Math.round(heist.rewardDirtyEuros * eurosMultiplier * 100) / 100
          : 0;

        const eurosShare =
          Math.round((totalCleanEuros / crewCount) * 100) / 100;
        const dirtyShare =
          Math.round((totalDirtyEuros / crewCount) * 100) / 100;
        const xpShare = succeeded
          ? Math.round(heist.rewardXp / crewCount)
          : Math.max(15, Math.round(heist.rewardXp * 0.2));
        const heatGain = Math.max(
          5,
          heist.baseHeat + (succeeded ? 0 : 12) - heatReduction,
        );

        const rewards: Array<{
          playerId: string;
          displayName: string;
          role: HeistRole;
          eurosGained: number;
          dirtyEurosGained: number;
          xpGained: number;
          heatGained: number;
          newLevel: number;
          newHeat: number;
          newWantedLevel: number;
        }> = [];

        for (const participant of lobby.participants) {
          const dbPlayer = players.find((p) => p.id === participant.playerId)!;
          const newXp = dbPlayer.xp + xpShare;
          const calcLevel = calculateLevelFromXp(newXp);
          const newLevel =
            calcLevel > dbPlayer.level ? calcLevel : dbPlayer.level;
          const newHeat = Math.min(100, (dbPlayer.heat ?? 0) + heatGain);
          const newWantedLevel = Math.min(5, Math.floor(newHeat / 20));

          const updated = await tx.player.update({
            where: { id: dbPlayer.id },
            data: {
              euros: { increment: eurosShare },
              dirtyEuros: { increment: dirtyShare },
              xp: newXp,
              level: newLevel,
              heat: newHeat,
              wantedLevel: newWantedLevel,
            },
          });

          if (eurosShare > 0) {
            await tx.transactionLog.create({
              data: {
                playerId: dbPlayer.id,
                type: 'EARN',
                amount: eurosShare,
                currency: 'EUR',
                reason: `Heist "${heist.name}" (${participant.role})`,
                reference: lobby.id,
              },
            });
          }

          rewards.push({
            playerId: dbPlayer.id,
            displayName: dbPlayer.displayName,
            role: participant.role,
            eurosGained: eurosShare,
            dirtyEurosGained: dirtyShare,
            xpGained: xpShare,
            heatGained: heatGain,
            newLevel: updated.level,
            newHeat: updated.heat,
            newWantedLevel: updated.wantedLevel,
          });
        }

        lobby.status = succeeded ? 'COMPLETED' : 'FAILED';
        lobby.executedAt = new Date().toISOString();

        return {
          outcome: lobby.status,
          succeeded,
          heist: {
            id: heist.id,
            name: heist.name,
            difficulty: heist.difficulty,
          },
          lobbyId: lobby.id,
          rewards,
          narrative: succeeded
            ? `¡Golpe ejecutado con éxito! "${heist.name}" deja ${totalCleanEuros}€ limpios y ${totalDirtyEuros}€ negros para la banda.`
            : `El golpe "${heist.name}" se torció y la policía cercó la zona. Escapáis con las manos vacías y el calor por las nubes.`,
        };
      });

      return result;
    } catch (err) {
      if (lobby.status === 'EXECUTING') {
        lobby.status = 'OPEN';
      }
      throw err;
    }
  }
}
