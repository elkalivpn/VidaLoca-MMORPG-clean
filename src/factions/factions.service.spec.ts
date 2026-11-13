import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FactionType } from '@prisma/client';
import { FactionsService } from './factions.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

describe('FactionsService', () => {
  let service: FactionsService;
  let prisma: {
    player: {
      groupBy: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let realtimeGateway: {
    emitPursuitEvent: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      player: {
        groupBy: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(async (cb: (tx: any) => any) =>
      cb(prisma),
    );

    realtimeGateway = {
      emitPursuitEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RealtimeGateway, useValue: realtimeGateway },
      ],
    }).compile();

    service = module.get<FactionsService>(FactionsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getCatalog', () => {
    it('returns all 5 factions with active member counts', async () => {
      prisma.player.groupBy.mockResolvedValue([
        { faction: FactionType.POLICE, _count: { _all: 3 } },
        { faction: FactionType.SYNDICATE, _count: { _all: 5 } },
      ]);

      const catalog = await service.getCatalog();

      expect(catalog).toHaveLength(5);
      const police = catalog.find((c) => c.id === FactionType.POLICE);
      const syndicate = catalog.find((c) => c.id === FactionType.SYNDICATE);
      const civilian = catalog.find((c) => c.id === FactionType.CIVILIAN);

      expect(police?.activeMembers).toBe(3);
      expect(syndicate?.activeMembers).toBe(5);
      expect(civilian?.activeMembers).toBe(0);
    });
  });

  describe('joinFaction', () => {
    const basePlayer = {
      id: 'player-1',
      userId: 'user-1',
      displayName: 'El Rubio',
      faction: FactionType.CIVILIAN,
      factionRank: 1,
      heat: 0,
      jailUntil: null,
    };

    it('throws NotFoundException when player does not exist', async () => {
      prisma.player.findUnique.mockResolvedValue(null);

      await expect(
        service.joinFaction('missing', FactionType.POLICE),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if already in that faction', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);

      await expect(
        service.joinFaction('user-1', FactionType.CIVILIAN),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects joining POLICE when heat > 0', async () => {
      prisma.player.findUnique.mockResolvedValue({ ...basePlayer, heat: 25 });

      await expect(
        service.joinFaction('user-1', FactionType.POLICE),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects joining GUARDIA_CIVIL while jailed', async () => {
      prisma.player.findUnique.mockResolvedValue({
        ...basePlayer,
        jailUntil: new Date(Date.now() + 60_000),
      });

      await expect(
        service.joinFaction('user-1', FactionType.GUARDIA_CIVIL),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows joining POLICE when heat === 0 and not jailed', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        faction: FactionType.POLICE,
        factionRank: 1,
      });

      const res = await service.joinFaction('user-1', FactionType.POLICE);

      expect(res.faction).toBe(FactionType.POLICE);
      expect(res.factionRank).toBe(1);
    });
  });

  describe('getWantedPlayers', () => {
    it('returns suspects with heat >= 40 and computed bountyEuros', async () => {
      prisma.player.findMany.mockResolvedValue([
        {
          id: 'sus-1',
          displayName: 'El Chispas',
          locationId: 'malasana',
          heat: 60,
          wantedLevel: 3,
        },
      ]);

      const wanted = await service.getWantedPlayers();

      expect(wanted).toHaveLength(1);
      expect(wanted[0]).toEqual({
        id: 'sus-1',
        displayName: 'El Chispas',
        locationId: 'malasana',
        heat: 60,
        wantedLevel: 3,
        bountyEuros: 225,
      });
    });
  });

  describe('interceptSuspect', () => {
    const agent = {
      id: 'agent-1',
      userId: 'user-agent',
      displayName: 'Agente García',
      faction: FactionType.POLICE,
      locationId: 'madrid_centro',
      xp: 100,
      level: 1,
      euros: 200,
      jailUntil: null,
      vehicles: [{ template: { speed: 95 } }],
    };

    const suspect = {
      id: 'suspect-1',
      userId: 'user-suspect',
      displayName: 'El Rápido',
      faction: FactionType.SYNDICATE,
      locationId: 'madrid_centro',
      heat: 60,
      wantedLevel: 3,
      euros: 500,
      reputation: 10,
      jailUntil: null,
      vehicles: [{ template: { speed: 65 } }],
    };

    it('forbids non-law-enforcement factions from intercepting', async () => {
      prisma.player.findUnique.mockResolvedValueOnce({
        ...agent,
        faction: FactionType.CIVILIAN,
      });

      await expect(
        service.interceptSuspect('user-agent', 'suspect-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects interception when suspect is in another zone', async () => {
      prisma.player.findUnique
        .mockResolvedValueOnce(agent)
        .mockResolvedValueOnce({ ...suspect, locationId: 'barcelona_ramblas' });

      await expect(
        service.interceptSuspect('user-agent', 'suspect-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects interception when suspect heat < 40', async () => {
      prisma.player.findUnique
        .mockResolvedValueOnce(agent)
        .mockResolvedValueOnce({ ...suspect, heat: 20 });

      await expect(
        service.interceptSuspect('user-agent', 'suspect-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('captures suspect, jails for 90s, clears heat/wanted, fines suspect, rewards agent, and emits pursuit:resolved', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);
      prisma.player.findUnique
        .mockResolvedValueOnce(agent)
        .mockResolvedValueOnce(suspect);
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...agent,
        euros: 425,
        xp: 165,
        level: 1,
      });

      const res = await service.interceptSuspect('user-agent', 'suspect-1');

      expect(res.captured).toBe(true);
      expect(res.outcome).toBe('CAPTURED');
      expect(res.suspect.heat).toBe(0);
      expect(res.suspect.wantedLevel).toBe(0);
      expect(prisma.player.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'suspect-1', euros: { gte: 280 } },
          data: expect.objectContaining({
            heat: 0,
            wantedLevel: 0,
            euros: { decrement: 280 },
          }),
        }),
      );
      expect(realtimeGateway.emitPursuitEvent).toHaveBeenCalledWith(
        'madrid_centro',
        expect.objectContaining({
          outcome: 'CAPTURED',
          captured: true,
        }),
      );
    });

    it('allows suspect to escape when random roll fails capture, increasing suspect rep/heat and giving partial XP to agent', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      prisma.player.findUnique
        .mockResolvedValueOnce(agent)
        .mockResolvedValueOnce(suspect);
      prisma.player.update
        .mockResolvedValueOnce({ ...suspect, heat: 70, wantedLevel: 3 })
        .mockResolvedValueOnce({ ...agent, xp: 112, level: 1 });

      const res = await service.interceptSuspect('user-agent', 'suspect-1');

      expect(res.captured).toBe(false);
      expect(res.outcome).toBe('ESCAPED');
      expect(res.suspect.heat).toBe(70);
      expect(res.agentXpGain).toBe(12);
      expect(realtimeGateway.emitPursuitEvent).toHaveBeenCalledWith(
        'madrid_centro',
        expect.objectContaining({
          outcome: 'ESCAPED',
          captured: false,
        }),
      );
    });
  });

  describe('payBail', () => {
    it('throws BadRequestException if player is not in jail', async () => {
      prisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        euros: 500,
        jailUntil: null,
      });

      await expect(service.payBail('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if player cannot afford bail atomically', async () => {
      prisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        euros: 10,
        jailUntil: new Date(Date.now() + 60_000),
      });
      prisma.player.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.payBail('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('releases player atomically when bail is paid', async () => {
      prisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        euros: 500,
        jailUntil: new Date(Date.now() + 30_000),
      });
      prisma.player.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.payBail('user-1');

      expect(res.released).toBe(true);
      expect(res.jailUntil).toBeNull();
      expect(res.bailCost).toBeGreaterThanOrEqual(50);
      expect(prisma.player.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'player-1',
            euros: { gte: res.bailCost },
          }),
          data: {
            euros: { decrement: res.bailCost },
            jailUntil: null,
          },
        }),
      );
    });
  });
});
