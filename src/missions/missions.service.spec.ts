import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Difficulty, MissionMode, MissionStatus } from '@prisma/client';
import { MissionsService } from './missions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AntiCheatService } from '../security/anti-cheat.service';

describe('MissionsService (Story, Online Solo, Online Co-op & Optional Choice)', () => {
  let service: MissionsService;
  let prisma: any;
  let antiCheat: { recordViolation: jest.Mock };

  const playerOne = {
    id: 'player-1',
    userId: 'user-1',
    displayName: 'El Gallego',
    level: 10,
    xp: 9500,
    euros: 1000,
    vidaCoins: 5,
    reputation: 50,
    locationId: 'coruna_marina',
    jailUntil: null,
  };

  const playerTwo = {
    id: 'player-2',
    userId: 'user-2',
    displayName: 'La Vasca',
    level: 12,
    xp: 12000,
    euros: 2000,
    vidaCoins: 10,
    reputation: 80,
    locationId: 'coruna_marina',
    jailUntil: null,
  };

  const soloTemplate = {
    id: 'tpl-galicia-1',
    title: 'Descarga Nocturna en Riazor',
    description: 'Misión opcional en A Coruña',
    difficulty: Difficulty.MEDIUM,
    mode: MissionMode.ONLINE_SOLO,
    category: 'CONTRABANDO',
    city: 'A Coruña',
    minLevel: 5,
    minPlayers: 1,
    maxPlayers: 1,
    isOptional: true,
    isRepeatable: true,
    cooldownHours: 12,
    requiredSteps: 2,
    rewardEuros: 1500,
    rewardXp: 400,
    rewardVidaCoins: 5,
    rewardReputation: 25,
    rewardItemName: 'Glock 19 Negra',
    unlockBenefit: '+400 XP + Glock 19 Negra',
    requirement: { minStepSeconds: 10 },
  };

  const coopTemplate = {
    ...soloTemplate,
    id: 'tpl-coop-1',
    title: 'Operación Ría de Vigo (Co-op)',
    mode: MissionMode.ONLINE_COOP,
    minPlayers: 2,
    maxPlayers: 4,
    isRepeatable: false,
    cooldownHours: 0,
  };

  beforeEach(async () => {
    prisma = {
      player: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      missionTemplate: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      playerMission: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      completedMission: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      transactionLog: {
        create: jest.fn(),
      },
      battlePassProgress: {
        findUnique: jest.fn().mockResolvedValue({
          playerId: 'player-1',
          xp: 100,
          level: 1,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      itemTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-glock',
          name: 'Glock 19 Negra',
          rarity: 'RARE',
        }),
      },
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (cb: (tx: any) => any) => cb(prisma)),
    };

    antiCheat = {
      recordViolation: jest.fn().mockResolvedValue({
        strikesInWindow: 1,
        shouldDisconnect: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AntiCheatService, useValue: antiCheat },
      ],
    }).compile();

    service = module.get<MissionsService>(MissionsService);
  });

  it('allows players to freely skip or abandon optional missions', async () => {
    prisma.player.findUnique.mockResolvedValue(playerOne);
    prisma.missionTemplate.findUnique.mockResolvedValue(soloTemplate);
    prisma.playerMission.findFirst.mockResolvedValue(null);
    prisma.playerMission.create.mockResolvedValue({
      id: 'pm-skip',
      status: MissionStatus.SKIPPED,
      template: soloTemplate,
    });

    const skipped = await service.skipMission('user-1', soloTemplate.id);
    expect(skipped.status).toBe(MissionStatus.SKIPPED);

    prisma.playerMission.findFirst.mockResolvedValue({
      id: 'pm-active',
      playerId: playerOne.id,
      status: MissionStatus.IN_PROGRESS,
      template: soloTemplate,
    });
    prisma.playerMission.update.mockResolvedValue({
      id: 'pm-active',
      status: MissionStatus.ABANDONED,
      template: soloTemplate,
    });

    const abandoned = await service.abandonMission('user-1', 'pm-active');
    expect(abandoned.status).toBe(MissionStatus.ABANDONED);
  });

  it('prevents anti-speedrun repeat loops via cooldownHours and minLevel gates', async () => {
    prisma.player.findUnique.mockResolvedValue({ ...playerOne, level: 2 });
    prisma.missionTemplate.findUnique.mockResolvedValue(soloTemplate);
    prisma.playerMission.findFirst.mockResolvedValue(null);

    await expect(service.startMission('user-1', soloTemplate.id)).rejects.toThrow(
      ForbiddenException,
    );

    prisma.player.findUnique.mockResolvedValue(playerOne);
    prisma.completedMission.findFirst.mockResolvedValue({
      completedAt: new Date(Date.now() - 3600_000), // 1h ago, needs 12h
    });

    await expect(service.startMission('user-1', soloTemplate.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('creates and joins ONLINE_COOP squads with friends and enforces city/crew/cooldown checks on advance', async () => {
    prisma.missionTemplate.findUnique.mockResolvedValue(soloTemplate);
    await expect(
      service.createCoopSquad('user-1', soloTemplate.id),
    ).rejects.toThrow(BadRequestException);

    prisma.missionTemplate.findUnique.mockResolvedValue(coopTemplate);
    prisma.player.findUnique.mockResolvedValue(playerOne);
    prisma.playerMission.findFirst.mockResolvedValue(null);
    prisma.completedMission.findFirst.mockResolvedValue(null);
    prisma.playerMission.create.mockImplementation(async ({ data }: any) => ({
      id: 'pm-coop-1',
      ...data,
      template: coopTemplate,
    }));

    const created = await service.createCoopSquad('user-1', coopTemplate.id);
    expect(created.squadCode).toMatch(/^VL-[A-F0-9]{6}$/);

    // Join with friend playerTwo
    prisma.player.findUnique.mockResolvedValue(playerTwo);
    prisma.playerMission.findFirst.mockResolvedValue(created);
    prisma.playerMission.update.mockImplementation(async ({ data }: any) => ({
      ...created,
      coOpParticipants: data.coOpParticipants,
    }));

    const joined = await service.joinCoopSquad('user-2', created.squadCode!);
    expect(joined.coOpParticipants).toHaveLength(2);

    // Rejects advance if player is in the wrong city
    prisma.player.findUnique.mockResolvedValue({
      ...playerOne,
      locationId: 'madrid_centro',
    });
    prisma.playerMission.findUnique.mockResolvedValue(joined);
    await expect(service.advanceMission('user-1', 'pm-coop-1')).rejects.toThrow(
      BadRequestException,
    );

    // Rejects rapid step spam (anti-speedrun) and logs violation
    prisma.player.findUnique.mockResolvedValue(playerOne);
    prisma.playerMission.findUnique.mockResolvedValue({
      ...joined,
      lastStepAt: new Date(),
    });
    await expect(service.advanceMission('user-1', 'pm-coop-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(antiCheat.recordViolation).toHaveBeenCalledWith(
      expect.objectContaining({ rule: 'MISSION_SPEEDRUN' }),
    );
  });

  it('grants +20% Co-op bonus, Battle Pass XP, unlocks items, and blocks concurrent double claim', async () => {
    const completedCoopMission = {
      id: 'pm-coop-done',
      playerId: playerOne.id,
      templateId: coopTemplate.id,
      status: MissionStatus.COMPLETED,
      progress: 100,
      squadCode: 'VL-AABBCC',
      coOpParticipants: [
        { playerId: playerOne.id, userId: playerOne.userId, displayName: playerOne.displayName, role: 'LEADER' },
        { playerId: playerTwo.id, userId: playerTwo.userId, displayName: playerTwo.displayName, role: 'MEMBER' },
      ],
      template: coopTemplate,
    };

    prisma.player.findUnique
      .mockResolvedValueOnce(playerOne)
      .mockResolvedValueOnce(playerTwo);
    prisma.playerMission.findUnique.mockResolvedValue(completedCoopMission);
    prisma.completedMission.findFirst.mockResolvedValue(null);
    prisma.playerMission.updateMany.mockResolvedValue({ count: 1 });
    prisma.player.update.mockImplementation(async ({ where, data }: any) => ({
      ...(where.id === playerOne.id ? playerOne : playerTwo),
      euros: 3000,
      xp: data.xp,
      level: data.level,
      vidaCoins: 10,
      reputation: 75,
    }));

    const claimed = await service.claimReward('user-1', 'pm-coop-done');

    expect(claimed.rewards.coopBonusApplied).toBe(true);
    expect(claimed.rewards.euros).toBe(1800); // 1500 * 1.2
    expect(claimed.rewards.xp).toBe(480); // 400 * 1.2
    expect(claimed.rewards.battlePassXp).toBe(120); // 25% of 480
    expect(claimed.rewards.unlockedItem?.name).toBe('Glock 19 Negra');
    expect(prisma.inventoryItem.create).toHaveBeenCalledTimes(2); // Both Co-op players get reward item

    // Concurrent double claim attempt
    prisma.player.findUnique.mockResolvedValue(playerOne);
    prisma.playerMission.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.claimReward('user-1', 'pm-coop-done')).rejects.toThrow(
      BadRequestException,
    );
    expect(antiCheat.recordViolation).toHaveBeenCalledWith(
      expect.objectContaining({ rule: 'DOUBLE_CLAIM' }),
    );
  });

  it('blocks non-VIP players from starting VIP missions and grants +15% EUR / +25% XP to VIPs', async () => {
    const vipTemplate = {
      ...soloTemplate,
      id: 'tpl-vip-1',
      title: 'VIP · Gala Privada en Puerto Banús',
      isVipOnly: true,
      rewardEuros: 1000,
      rewardXp: 400,
    };

    prisma.player.findUnique.mockResolvedValue({ ...playerOne, isVip: false });
    prisma.missionTemplate.findUnique.mockResolvedValue(vipTemplate);

    await expect(
      service.startMission('user-1', vipTemplate.id),
    ).rejects.toThrow(ForbiddenException);

    const activeVipPlayer = {
      ...playerOne,
      isVip: true,
      vipExpiresAt: new Date(Date.now() + 86_400_000),
    };
    prisma.player.findUnique.mockResolvedValue(activeVipPlayer);
    prisma.playerMission.findFirst.mockResolvedValue(null);
    prisma.completedMission.findFirst.mockResolvedValue(null);
    prisma.playerMission.create.mockResolvedValue({
      id: 'pm-vip-1',
      status: MissionStatus.IN_PROGRESS,
      template: vipTemplate,
    });

    const started = await service.startMission('user-1', vipTemplate.id);
    expect(started.id).toBe('pm-vip-1');

    prisma.playerMission.findUnique.mockResolvedValue({
      id: 'pm-vip-1',
      playerId: activeVipPlayer.id,
      templateId: vipTemplate.id,
      status: MissionStatus.COMPLETED,
      progress: 100,
      template: vipTemplate,
    });
    prisma.playerMission.updateMany.mockResolvedValue({ count: 1 });
    prisma.player.update.mockResolvedValue({
      ...activeVipPlayer,
      euros: 2150,
      xp: 10000,
      level: 10,
    });

    const claimed = await service.claimReward('user-1', 'pm-vip-1');
    expect(claimed.rewards.vipBonusApplied).toBe(true);
    expect(claimed.rewards.euros).toBe(1150); // 1000 * 1.15
    expect(claimed.rewards.xp).toBe(500); // 400 * 1.25
  });
});
