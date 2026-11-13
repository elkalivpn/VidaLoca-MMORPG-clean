import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorldService } from './world.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZONES, HIGHWAY_ROUTES } from '../common/constants/zones';

describe('WorldService', () => {
  let service: WorldService;
  let prisma: {
    territory: { findMany: jest.Mock };
    player: { findUnique: jest.Mock; update: jest.Mock };
    playerVehicle: { findFirst: jest.Mock };
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
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(async (cb: (tx: any) => any) =>
      cb(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorldService,
        { provide: PrismaService, useValue: prisma },
      ],
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

      await expect(
        service.travel('user-1', 'madrid_centro'),
      ).rejects.toThrow(BadRequestException);
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
      prisma.player.update.mockImplementation(async ({ data }: any) => ({
        ...basePlayer,
        ...data,
      }));

      const result = await service.travel('user-1', 'malasana');

      expect(result.from.id).toBe('madrid_centro');
      expect(result.to.id).toBe('malasana');
      expect(result.highway).toBe('Urbano');
      expect(result.distanceKm).toBeGreaterThanOrEqual(1);
      expect(result.vehicleUsed.mode).toBe('VEHICLE');
      expect(result.vehicleUsed.name).toBe('Seat León FR');
      expect(result.player.locationId).toBe('malasana');
      expect(result.player.euros).toBe(
        Math.round((500 - result.costEuros) * 100) / 100,
      );
    });

    it('travels intercity via highway graph using public transport when no vehicle exists', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.playerVehicle.findFirst.mockResolvedValue(null);
      prisma.player.update.mockImplementation(async ({ data }: any) => ({
        ...basePlayer,
        ...data,
      }));

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
      prisma.player.update.mockImplementation(async ({ data }: any) => ({
        ...malasanaPlayer,
        ...data,
      }));

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
      prisma.player.update.mockImplementation(async ({ data }: any) => ({
        ...hotPlayer,
        ...data,
      }));

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
      prisma.player.update.mockImplementation(async ({ data }: any) => ({
        ...hotPlayer,
        ...data,
      }));

      const result = await service.travel('user-1', 'valencia_artes');

      expect(result.player.heat).toBeGreaterThan(60);
      expect(result.narrative).toContain('Guardia Civil');
      expect(result.narrative).toContain('multa');
      expect(result.costEuros).toBeGreaterThan(50);
    });
  });
});
