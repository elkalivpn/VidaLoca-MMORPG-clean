import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MarketListingStatus } from '@prisma/client';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let prisma: {
    player: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    inventoryItem: {
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    marketListing: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    itemTemplate: {
      findFirst: jest.Mock;
    };
    transactionLog: {
      create: jest.Mock;
      createMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      player: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      inventoryItem: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      marketListing: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      itemTemplate: {
        findFirst: jest.fn(),
      },
      transactionLog: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(async (cb: (tx: any) => any) =>
      cb(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
  });

  it('buys an active P2P listing, deducts 5% fee, and transfers item', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'buyer-1' });
    prisma.marketListing.findUnique.mockResolvedValue({
      id: 'lst-1',
      sellerId: 'seller-1',
      templateId: 'tpl-1',
      quantity: 2,
      priceEuros: 1000,
      status: MarketListingStatus.ACTIVE,
      template: { name: 'AK-47 Táctica' },
    });
    prisma.marketListing.updateMany.mockResolvedValue({ count: 1 });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    prisma.player.update.mockResolvedValue({});
    prisma.inventoryItem.findFirst.mockResolvedValue(null);
    prisma.inventoryItem.create.mockResolvedValue({});
    prisma.transactionLog.createMany.mockResolvedValue({});

    const res = await service.buyListing('u-buyer', 'lst-1');

    expect(res.priceEuros).toBe(1000);
    expect(res.feeEuros).toBe(50);
    expect(res.sellerNetEuros).toBe(950);
    expect(prisma.inventoryItem.create).toHaveBeenCalledTimes(1);
  });

  it('forbids buying own listing', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'seller-1' });
    prisma.marketListing.findUnique.mockResolvedValue({
      id: 'lst-1',
      sellerId: 'seller-1',
      status: MarketListingStatus.ACTIVE,
      template: { name: 'Item' },
    });

    await expect(service.buyListing('u-seller', 'lst-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('forbids cancelling another player listing', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'other-1' });
    prisma.marketListing.findUnique.mockResolvedValue({
      id: 'lst-1',
      sellerId: 'seller-1',
      status: MarketListingStatus.ACTIVE,
    });

    await expect(service.cancelListing('u-other', 'lst-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('activates 7-day Club VIP with VidaCoins', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      vidaCoins: 200,
      vipExpiresAt: null,
    });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    prisma.player.update.mockResolvedValue({});
    prisma.transactionLog.create.mockResolvedValue({});

    const res = await service.buyVipOffer('u1', 'vip_7d');

    expect(res.offerId).toBe('vip_7d');
    expect(res.priceVida).toBe(120);
    expect(prisma.player.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isVip: true }),
      }),
    );
  });
});
