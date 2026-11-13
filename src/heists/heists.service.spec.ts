import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HeistsService, HEIST_CATALOG } from './heists.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HeistsService', () => {
  let service: HeistsService;
  let prisma: {
    player: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    transactionLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const leaderPlayer = {
    id: 'player-1',
    userId: 'user-1',
    displayName: 'El Jefe',
    level: 6,
    xp: 5200,
    euros: 500,
    dirtyEuros: 0,
    heat: 10,
    wantedLevel: 0,
    locationId: 'madrid_centro',
    jailUntil: null,
  };

  const hackerPlayer = {
    id: 'player-2',
    userId: 'user-2',
    displayName: 'La Teclas',
    level: 4,
    xp: 3100,
    euros: 300,
    dirtyEuros: 100,
    heat: 15,
    wantedLevel: 0,
    locationId: 'madrid_centro',
    jailUntil: null,
  };

  const enforcerPlayer = {
    id: 'player-3',
    userId: 'user-3',
    displayName: 'El Maza',
    level: 5,
    xp: 4100,
    euros: 200,
    dirtyEuros: 0,
    heat: 20,
    wantedLevel: 1,
    locationId: 'madrid_centro',
    jailUntil: null,
  };

  beforeEach(async () => {
    prisma = {
      player: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      transactionLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(async (cb: (tx: any) => any) =>
      cb(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeistsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<HeistsService>(HeistsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getCatalogAndLobbies', () => {
    it('returns the 3 Spain heists and active open lobbies', async () => {
      prisma.player.findUnique.mockResolvedValue(leaderPlayer);
      await service.createLobby('user-1', {
        heistId: 'blindado_castellana',
        role: 'DRIVER',
      });

      const res = service.getCatalogAndLobbies();

      expect(res.catalog).toHaveLength(3);
      expect(res.catalog.map((h) => h.id)).toEqual(
        HEIST_CATALOG.map((h) => h.id),
      );
      expect(res.activeLobbies).toHaveLength(1);
      expect(res.activeLobbies[0].zoneId).toBe('madrid_centro');
    });
  });

  describe('createLobby', () => {
    it('throws NotFoundException for unknown heistId', async () => {
      await expect(
        service.createLobby('user-1', { heistId: 'golpe_inventado' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when player is jailed', async () => {
      prisma.player.findUnique.mockResolvedValue({
        ...leaderPlayer,
        jailUntil: new Date(Date.now() + 60_000),
      });

      await expect(
        service.createLobby('user-1', { heistId: 'blindado_castellana' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when player level is below minLevel', async () => {
      prisma.player.findUnique.mockResolvedValue({
        ...leaderPlayer,
        level: 2,
      });

      await expect(
        service.createLobby('user-1', { heistId: 'puerto_barcelona' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates lobby in player current zone and prevents duplicate active lobby', async () => {
      prisma.player.findUnique.mockResolvedValue({
        ...leaderPlayer,
        locationId: 'puerto_banus',
      });

      const lobby = await service.createLobby('user-1', {
        heistId: 'yate_puerto_banus',
        role: 'DRIVER',
      });

      expect(lobby.zoneId).toBe('puerto_banus');
      expect(lobby.status).toBe('OPEN');
      expect(lobby.participants).toHaveLength(1);
      expect(lobby.participants[0].role).toBe('DRIVER');

      await expect(
        service.createLobby('user-1', { heistId: 'blindado_castellana' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('joinLobby', () => {
    it('allows another player in the same zone to join with a free role', async () => {
      prisma.player.findUnique.mockResolvedValueOnce(leaderPlayer);
      const lobby = await service.createLobby('user-1', {
        heistId: 'yate_puerto_banus',
        role: 'DRIVER',
      });

      prisma.player.findUnique.mockResolvedValueOnce(hackerPlayer);
      const updated = await service.joinLobby('user-2', lobby.id, {
        role: 'HACKER',
      });

      expect(updated.participants).toHaveLength(2);
      expect(updated.participants[1].role).toBe('HACKER');
    });

    it('rejects joining if role is already taken', async () => {
      prisma.player.findUnique.mockResolvedValueOnce(leaderPlayer);
      const lobby = await service.createLobby('user-1', {
        heistId: 'blindado_castellana',
        role: 'DRIVER',
      });

      prisma.player.findUnique.mockResolvedValueOnce(hackerPlayer);
      await expect(
        service.joinLobby('user-2', lobby.id, { role: 'DRIVER' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects joining from a different zone', async () => {
      prisma.player.findUnique.mockResolvedValueOnce(leaderPlayer);
      const lobby = await service.createLobby('user-1', {
        heistId: 'blindado_castellana',
        role: 'DRIVER',
      });

      prisma.player.findUnique.mockResolvedValueOnce({
        ...hackerPlayer,
        locationId: 'barcelona_ramblas',
      });

      await expect(
        service.joinLobby('user-2', lobby.id, { role: 'HACKER' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('executeLobby', () => {
    it('rejects execution when crew size is below minCrew', async () => {
      prisma.player.findUnique.mockResolvedValueOnce(leaderPlayer);
      const lobby = await service.createLobby('user-1', {
        heistId: 'yate_puerto_banus',
        role: 'DRIVER',
      });

      prisma.player.findUnique.mockResolvedValueOnce(leaderPlayer);
      await expect(
        service.executeLobby('user-1', lobby.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects execution by a player who is not in the lobby', async () => {
      prisma.player.findUnique.mockResolvedValueOnce(leaderPlayer);
      const lobby = await service.createLobby('user-1', {
        heistId: 'blindado_castellana',
        role: 'DRIVER',
      });

      prisma.player.findUnique.mockResolvedValueOnce(enforcerPlayer);
      await expect(
        service.executeLobby('user-3', lobby.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('executes heist atomically on success and distributes euros, dirtyEuros, xp, heat, and wantedLevel', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.05);

      prisma.player.findUnique.mockResolvedValueOnce(leaderPlayer);
      const lobby = await service.createLobby('user-1', {
        heistId: 'blindado_castellana',
        role: 'DRIVER',
      });

      prisma.player.findUnique.mockResolvedValueOnce(hackerPlayer);
      await service.joinLobby('user-2', lobby.id, { role: 'HACKER' });

      prisma.player.findUnique.mockResolvedValueOnce(leaderPlayer);
      prisma.player.findMany.mockResolvedValueOnce([leaderPlayer, hackerPlayer]);
      prisma.player.update.mockImplementation(async ({ where, data }: any) => {
        const base = where.id === 'player-1' ? leaderPlayer : hackerPlayer;
        return {
          ...base,
          xp: data.xp,
          level: data.level,
          heat: data.heat,
          wantedLevel: data.wantedLevel,
        };
      });

      const res = await service.executeLobby('user-1', lobby.id);

      expect(res.succeeded).toBe(true);
      expect(res.outcome).toBe('COMPLETED');
      expect(res.rewards).toHaveLength(2);
      expect(res.rewards[0].eurosGained).toBe(600);
      expect(res.rewards[0].dirtyEurosGained).toBe(1250);
      expect(res.rewards[0].xpGained).toBe(125);
      expect(res.rewards[0].heatGained).toBe(20); // 25 base - 5 DRIVER bonus
      expect(prisma.player.update).toHaveBeenCalledTimes(2);
      expect(prisma.transactionLog.create).toHaveBeenCalledTimes(2);

      const { activeLobbies } = service.getCatalogAndLobbies();
      expect(activeLobbies).toHaveLength(0);
    });

    it('handles failed heist by giving 0 euros/dirtyEuros, partial xp, and higher heat', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      prisma.player.findUnique.mockResolvedValueOnce(leaderPlayer);
      const lobby = await service.createLobby('user-1', {
        heistId: 'blindado_castellana',
        role: 'ENFORCER',
      });

      prisma.player.findUnique.mockResolvedValueOnce(leaderPlayer);
      prisma.player.findMany.mockResolvedValueOnce([leaderPlayer]);
      prisma.player.update.mockImplementation(async ({ data }: any) => ({
        ...leaderPlayer,
        xp: data.xp,
        level: data.level,
        heat: data.heat,
        wantedLevel: data.wantedLevel,
      }));

      const res = await service.executeLobby('user-1', lobby.id);

      expect(res.succeeded).toBe(false);
      expect(res.outcome).toBe('FAILED');
      expect(res.rewards[0].eurosGained).toBe(0);
      expect(res.rewards[0].dirtyEurosGained).toBe(0);
      expect(res.rewards[0].xpGained).toBe(50);
      expect(res.rewards[0].heatGained).toBe(37); // 25 base + 12 fail
      expect(prisma.transactionLog.create).not.toHaveBeenCalled();
    });
  });
});
