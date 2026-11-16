import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let prisma: {
    player: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    propertyTemplate: {
      findUnique: jest.Mock;
    };
    playerProperty: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    transactionLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      player: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      propertyTemplate: {
        findUnique: jest.fn(),
      },
      playerProperty: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
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
        PropertiesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
  });

  it('throws NotFoundException if property is not owned', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      faction: 'CIVILIAN',
    });
    prisma.playerProperty.findFirst.mockResolvedValue(null);

    await expect(service.collectRent('u1', 'prop-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('treats rentYield > 1 as fixed EUR rent instead of price multiplier', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      faction: 'CIVILIAN',
    });
    prisma.playerProperty.findFirst.mockResolvedValue({
      id: 'prop-1',
      playerId: 'p1',
      template: {
        name: 'Ático Soho Málaga',
        priceEuros: 195000,
        rentYield: 1450,
      },
    });
    prisma.playerProperty.updateMany.mockResolvedValue({ count: 1 });
    prisma.player.update.mockResolvedValue({ euros: 6450 });
    prisma.transactionLog.create.mockResolvedValue({});

    const res = await service.collectRent('u1', 'prop-1');

    expect(res.rent).toBe(1450);
    expect(res.newBalance).toBe(6450);
  });

  it('treats rentYield <= 1 as percentage rate and grants +15% to ENTREPRENEUR', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      faction: 'ENTREPRENEUR',
    });
    prisma.playerProperty.findFirst.mockResolvedValue({
      id: 'prop-2',
      playerId: 'p1',
      template: {
        name: 'Local Comercial',
        priceEuros: 100000,
        rentYield: 0.02,
      },
    });
    prisma.playerProperty.updateMany.mockResolvedValue({ count: 1 });
    prisma.player.update.mockResolvedValue({ euros: 7300 });
    prisma.transactionLog.create.mockResolvedValue({});

    const res = await service.collectRent('u1', 'prop-2');

    expect(res.rent).toBe(2300);
  });

  it('grants +15% rent bonus to active VIP players and blocks non-VIP from buying VIP properties', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p-vip',
      faction: 'CIVILIAN',
      isVip: true,
      vipExpiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.playerProperty.findFirst.mockResolvedValue({
      id: 'prop-vip',
      playerId: 'p-vip',
      template: {
        name: 'Villa Acantilado Es Vedrà VIP',
        priceEuros: 780000,
        rentYield: 1000,
      },
    });
    prisma.playerProperty.updateMany.mockResolvedValue({ count: 1 });
    prisma.player.update.mockResolvedValue({ euros: 1150 });
    prisma.transactionLog.create.mockResolvedValue({});

    const vipRent = await service.collectRent('u-vip', 'prop-vip');
    expect(vipRent.rent).toBe(1150);
    expect(vipRent.vipBonusApplied).toBe(true);

    prisma.player.findUnique.mockResolvedValue({
      id: 'p-std',
      euros: 1000000,
      vidaCoins: 500,
      isVip: false,
    });
    prisma.propertyTemplate.findUnique.mockResolvedValue({
      id: 'tpl-vip',
      name: 'Villa Acantilado Es Vedrà VIP',
      priceEuros: 780000,
      priceVida: 180,
      isVipOnly: true,
    });

    await expect(
      service.buyProperty('u-std', { templateId: 'tpl-vip' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects rent collection during 1-hour cooldown', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      faction: 'CIVILIAN',
    });
    prisma.playerProperty.findFirst.mockResolvedValue({
      id: 'prop-1',
      playerId: 'p1',
      template: {
        name: 'Piso',
        priceEuros: 85000,
        rentYield: 650,
      },
    });
    prisma.playerProperty.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.collectRent('u1', 'prop-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
