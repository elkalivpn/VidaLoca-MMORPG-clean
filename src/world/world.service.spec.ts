import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorldService } from './world.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZONES, HIGHWAY_ROUTES } from '../common/constants/zones';

describe('WorldService', () => {
  let service: WorldService;
  let prisma: {
    territory: { findMany: jest.Mock };
    player: { findUnique: jest.Mock; update: jest.Mock };
    playerVehicle: { findFirst: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      territory: {
        findMany: jest.fn(),
      },
      player: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      playerVehicle: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((cb: (tx: any) => any) =>
      Promise.resolve(cb(prisma)),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [WorldService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<WorldService>(WorldService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getMapState', () => {
    it('returns zones, highway routes, and territories with controller info', async () => {
      const mockTerritories = [
        {
          id: 'terr-1',
          name: 'Puerto de Barcelona',
          city: 'Barcelona',
          incomeRate: 250,
          bonusType: 'SMUGGLING',
          controllerId: 'clan-1',
          controller: { id: 'clan-1', name: 'Los Condes', tag: 'CND' },
        },
      ];
      prisma.territory.findMany.mockResolvedValue(mockTerritories);

      const result = await service.getMapState();

      expect(prisma.territory.findMany).toHaveBeenCalledWith({
        include: {
          controller: {
            select: { id: true, name: true, tag: true },
          },
        },
        orderBy: { city: 'asc' },
      });
      expect(result.zones).toEqual(ZONES);
      expect(result.routes).toEqual(HIGHWAY_ROUTES);
      expect(result.territories).toEqual(mockTerritories);
    });
  });

  describe('travel', () => {
    const basePlayer = {
      id: 'player-1',
      userId: 'user-1',
      displayName: 'El Rubio',
      level: 5,
      xp: 450,
      euros: 500,
      reputation: 20,
      heat: 10,
      locationId: 'madrid_centro',
    };

    it('throws BadRequestException when destinationId is invalid', async () => {
      await expect(service.travel('user-1', 'atlantida')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when player does not exist', async () => {
      prisma.player.findUnique.mockResolvedValue(null);

      await expect(
        service.travel('missing-user', 'barcelona_ramblas'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when already in destination zone', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);

      await expect(service.travel('user-1', 'madrid_centro')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('travels within the same city using haversine distance and primary vehicle', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.playerVehicle.findFirst.mockResolvedValue({
        id: 'veh-1',
        licensePlate: '1234ABC',
        condition: 100,
        isPrimary: true,
        template: {
          name: 'Seat León FR',
          brand: 'Seat',
          speed: 75,
        },
      });
      prisma.player.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          ...basePlayer,
          ...data,
        }),
      );

      const result = await service.travel('user-1', 'malasana');

      expect(result.from.id).toBe('madrid_centro');
      expect(result.to.id).toBe('malasana');
      expect(result.highway).toBe('Urbano');
      expect(result.distanceKm).toBeGreaterThanOrEqual(1);
      expect(result.vehicleUsed.mode).toBe('VEHICLE');
      expect(result.vehicleUsed.name).toBe('Seat León FR');
      expect(result.vehicleUsed.condition).toBe(99);
      expect(result.player.locationId).toBe('malasana');
      expect(result.player.euros).toBe(
        Math.round((500 - result.costEuros) * 100) / 100,
      );
    });

    it('travels intercity via highway graph using public transport when no vehicle exists', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.playerVehicle.findFirst.mockResolvedValue(null);
      prisma.player.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          ...basePlayer,
          ...data,
        }),
      );

      const result = await service.travel('user-1', 'barcelona_ramblas');

      expect(result.highway).toBe('A-2');
      expect(result.distanceKm).toBe(620);
      expect(result.vehicleUsed.mode).toBe('PUBLIC_TRANSPORT');
      expect(result.vehicleUsed.name).toBe('Transporte Público');
      expect(result.costEuros).toBeGreaterThan(0);
      expect(result.durationSec).toBeGreaterThan(0);
      expect(result.player.locationId).toBe('barcelona_ramblas');
    });

    it('routes between secondary neighborhoods of different cities via city hubs', async () => {
      const malasanaPlayer = { ...basePlayer, locationId: 'malasana' };
      prisma.player.findUnique.mockResolvedValue(malasanaPlayer);
      prisma.playerVehicle.findFirst.mockResolvedValue(null);
      prisma.player.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          ...malasanaPlayer,
          ...data,
        }),
      );

      const result = await service.travel('user-1', 'barcelona_gotico');

      expect(result.highway).toBe('A-2');
      expect(result.distanceKm).toBeGreaterThan(620);
      expect(result.player.locationId).toBe('barcelona_gotico');
    });

    it('throws BadRequestException if player cannot afford the trip', async () => {
      prisma.player.findUnique.mockResolvedValue({
        ...basePlayer,
        euros: 5,
      });
      prisma.playerVehicle.findFirst.mockResolvedValue(null);

      await expect(
        service.travel('user-1', 'barcelona_ramblas'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.player.update).not.toHaveBeenCalled();
    });

    it('evades Guardia Civil checkpoint when heat >= 50 and vehicle speed >= 80', async () => {
      const hotPlayer = { ...basePlayer, heat: 65 };
      prisma.player.findUnique.mockResolvedValue(hotPlayer);
      prisma.playerVehicle.findFirst.mockResolvedValue({
        id: 'veh-fast',
        licensePlate: '9999XYZ',
        condition: 95,
        isPrimary: true,
        template: {
          name: 'Porsche 911',
          brand: 'Porsche',
          speed: 95,
        },
      });
      prisma.player.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          ...hotPlayer,
          ...data,
        }),
      );

      const result = await service.travel('user-1', 'valencia_artes');

      expect(result.highway).toBe('A-3');
      expect(result.player.heat).toBe(65);
      expect(result.narrative).toContain('evadirlo');
    });

    it('applies Guardia Civil fine and heat increase when heat >= 50 and vehicle is slow', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);
      const hotPlayer = { ...basePlayer, heat: 60, euros: 500 };
      prisma.player.findUnique.mockResolvedValue(hotPlayer);
      prisma.playerVehicle.findFirst.mockResolvedValue({
        id: 'veh-slow',
        licensePlate: '0000OLD',
        condition: 80,
        isPrimary: true,
        template: {
          name: 'Furgoneta C15',
          brand: 'Citroën',
          speed: 55,
        },
      });
      prisma.player.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          ...hotPlayer,
          ...data,
        }),
      );

      const result = await service.travel('user-1', 'valencia_artes');

      expect(result.player.heat).toBeGreaterThan(60);
      expect(result.narrative).toContain('Guardia Civil');
      expect(result.narrative).toContain('multa');
      expect(result.costEuros).toBeGreaterThan(50);
    });

    it('throws ForbiddenException when player is jailed during travel', async () => {
      prisma.player.findUnique.mockResolvedValue({
        ...basePlayer,
        jailUntil: new Date(Date.now() + 60_000),
      });

      await expect(
        service.travel('user-1', 'barcelona_ramblas'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.player.update).not.toHaveBeenCalled();
    });
  });

  describe('performAction', () => {
    it('throws ForbiddenException when player is jailed', async () => {
      prisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        level: 5,
        xp: 450,
        euros: 500,
        reputation: 20,
        heat: 0,
        locationId: 'madrid_centro',
        jailUntil: new Date(Date.now() + 60_000),
      });

      await expect(
        service.performAction('user-1', 'trabajo_legal'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.player.update).not.toHaveBeenCalled();
    });
  });

  describe('regional market', () => {
    it('loads persisted marketCargo from database and saves BUY/SELL with CARTEL_MARITIMO coastal bonus', async () => {
      const coastalPlayer = {
        id: 'player-1',
        userId: 'user-1',
        locationId: 'vigo_puerto',
        euros: 5000,
        faction: 'CARTEL_MARITIMO',
        jailUntil: null,
        marketCargo: {
          relojes_lujo: 2,
          tech_chips: 0,
          aceite_gourmet: 1,
          piezas_tuning: 0,
        },
      };
      (prisma.player as any).updateMany = jest
        .fn()
        .mockResolvedValue({ count: 1 });
      (prisma as any).transactionLog = {
        create: jest.fn().mockResolvedValue({}),
      };

      prisma.player.findUnique.mockResolvedValue(coastalPlayer);
      const market = await service.getMarket('user-1');
      expect(market.currentCity).toBe('Vigo');
      const watches = market.goods.find((g) => g.id === 'relojes_lujo');
      expect(watches?.owned).toBe(2);

      prisma.player.update.mockResolvedValue({ ...coastalPlayer, euros: 5800 });
      const sellRes = await service.tradeMarket('user-1', {
        goodId: 'relojes_lujo',
        action: 'SELL',
        quantity: 2,
      });

      expect(sellRes.maritimeBonusApplied).toBe(true);
      expect(sellRes.owned).toBe(0);
      expect(prisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'player-1' },
          data: expect.objectContaining({
            marketCargo: expect.objectContaining({ relojes_lujo: 0 }),
          }),
        }),
      );
    });
  });

  describe('resolvePvpKnockout', () => {
    it('deducts up to 60€ atomically from target and rewards attacker with +loot, +30 XP, +10 rep, +10 heat', async () => {
      const attacker = {
        id: 'att-player',
        userId: 'att-user',
        level: 2,
        xp: 120,
        euros: 300,
        reputation: 15,
        heat: 20,
      };
      const target = {
        id: 'tgt-player',
        userId: 'tgt-user',
        level: 2,
        xp: 100,
        euros: 250,
        reputation: 10,
        heat: 5,
      };
      (prisma.player as any).updateMany = jest
        .fn()
        .mockResolvedValue({ count: 1 });

      prisma.player.findUnique
        .mockResolvedValueOnce(attacker)
        .mockResolvedValueOnce(target);
      prisma.player.update.mockResolvedValue({
        ...attacker,
        euros: 360,
        xp: 150,
        level: 2,
        reputation: 25,
        heat: 30,
        wantedLevel: 1,
      });

      const res = await service.resolvePvpKnockout('att-user', 'tgt-user');

      expect((prisma.player as any).updateMany).toHaveBeenCalledWith({
        where: { id: 'tgt-player', euros: { gte: 60 } },
        data: { euros: { decrement: 60 } },
      });
      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: 'att-player' },
        data: expect.objectContaining({
          euros: { increment: 60 },
          xp: 150,
          reputation: 25,
          heat: 30,
          wantedLevel: 1,
        }),
      });
      expect(res).toEqual({
        lootEuros: 60,
        attackerStats: {
          level: 2,
          xp: 150,
          euros: 360,
          reputation: 25,
          heat: 30,
          wantedLevel: 1,
        },
        targetRemainingEuros: 190,
      });
    });

    it('caps loot to target balance when target has less than 60€ and handles concurrent debit failure safely', async () => {
      const attacker = {
        id: 'att-player',
        userId: 'att-user',
        level: 1,
        xp: 10,
        euros: 100,
        reputation: 0,
        heat: 95,
      };
      const target = {
        id: 'tgt-player',
        userId: 'tgt-user',
        euros: 25.5,
      };
      (prisma.player as any).updateMany = jest
        .fn()
        .mockResolvedValue({ count: 0 });

      prisma.player.findUnique
        .mockResolvedValueOnce(attacker)
        .mockResolvedValueOnce(target);
      prisma.player.update.mockResolvedValue({
        ...attacker,
        euros: 100,
        xp: 40,
        reputation: 10,
        heat: 100,
        wantedLevel: 5,
      });

      const res = await service.resolvePvpKnockout('att-user', 'tgt-user');

      expect((prisma.player as any).updateMany).toHaveBeenCalledWith({
        where: { id: 'tgt-player', euros: { gte: 25 } },
        data: { euros: { decrement: 25 } },
      });
      expect(res.lootEuros).toBe(0);
      expect(res.targetRemainingEuros).toBe(25.5);
      expect(res.attackerStats.heat).toBe(100);
      expect(res.attackerStats.xp).toBe(40);
      expect(res.attackerStats.reputation).toBe(10);
    });

    it('rejects self-knockout and missing players', async () => {
      await expect(
        service.resolvePvpKnockout('same-user', 'same-user'),
      ).rejects.toThrow(BadRequestException);

      prisma.player.findUnique
        .mockResolvedValueOnce({ id: 'p1', userId: 'u1' })
        .mockResolvedValueOnce(null);

      await expect(service.resolvePvpKnockout('u1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
