import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let prisma: {
    player: { findUnique: jest.Mock; updateMany: jest.Mock };
    vehicleTemplate: { findUnique: jest.Mock; findMany: jest.Mock };
    playerVehicle: { create: jest.Mock };
    transactionLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      player: { findUnique: jest.fn(), updateMany: jest.fn() },
      vehicleTemplate: { findUnique: jest.fn(), findMany: jest.fn() },
      playerVehicle: { create: jest.fn() },
      transactionLog: { create: jest.fn() },
      $transaction: jest.fn(async (cb: (tx: any) => any) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<VehiclesService>(VehiclesService);
  });

  it('blocks non-VIP players from buying VIP-only vehicles', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      euros: 1000000,
      vidaCoins: 1000,
      isVip: false,
    });
    prisma.vehicleTemplate.findUnique.mockResolvedValue({
      id: 'veh-vip',
      name: 'Bolide Track Edition VIP',
      priceEuros: null,
      priceVida: 480,
      isVipOnly: true,
    });

    await expect(
      service.buyVehicle('u1', { templateId: 'veh-vip' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('supports purchasing dual-currency VIP vehicle using VIDACOIN currency selector', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p-vip',
      euros: 500,
      vidaCoins: 600,
      isVip: true,
      vipExpiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.vehicleTemplate.findUnique.mockResolvedValue({
      id: 'veh-sf90',
      name: 'SF90 XX Stradale VIP',
      priceEuros: 540000,
      priceVida: 420,
      isVipOnly: true,
    });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    prisma.playerVehicle.create.mockResolvedValue({
      id: 'pv-1',
      licensePlate: 'VL2026',
    });
    prisma.transactionLog.create.mockResolvedValue({});

    const vehicle = await service.buyVehicle('u-vip', {
      templateId: 'veh-sf90',
      currency: 'VIDACOIN',
    });

    expect(vehicle.id).toBe('pv-1');
    expect(prisma.player.updateMany).toHaveBeenCalledWith({
      where: { id: 'p-vip', vidaCoins: { gte: 420 } },
      data: { vidaCoins: { decrement: 420 } },
    });
  });

  it('rejects EUR purchase when vehicle is priced exclusively in VidaCoins', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p-vip',
      euros: 999999,
      vidaCoins: 500,
      isVip: true,
    });
    prisma.vehicleTemplate.findUnique.mockResolvedValue({
      id: 'veh-vc',
      name: 'Bolide Track Edition VIP',
      priceEuros: null,
      priceVida: 480,
      isVipOnly: true,
    });

    await expect(
      service.buyVehicle('u-vip', { templateId: 'veh-vc', currency: 'EUR' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('auto-marks the first purchased vehicle as primary when player has none', async () => {
    (prisma.playerVehicle as any).findFirst = jest.fn().mockResolvedValue(null);
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      euros: 5000,
      vidaCoins: 0,
      isVip: false,
    });
    prisma.vehicleTemplate.findUnique.mockResolvedValue({
      id: 'vespa-1',
      name: 'Vespa Primavera 125',
      priceEuros: 650,
      priceVida: null,
      isVipOnly: false,
    });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    prisma.playerVehicle.create.mockImplementation(async ({ data }: any) => ({
      id: 'pv-first',
      ...data,
    }));
    prisma.transactionLog.create.mockResolvedValue({});

    const first = await service.buyVehicle('u1', { templateId: 'vespa-1' });
    expect(first.isPrimary).toBe(true);

    (prisma.playerVehicle as any).findFirst.mockResolvedValue({ id: 'pv-first' });
    const second = await service.buyVehicle('u1', { templateId: 'vespa-1' });
    expect(second.isPrimary).toBe(false);
  });
});
