import { Test, TestingModule } from '@nestjs/testing';
import { ItemType } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: {
    player: { findUnique: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
    itemTemplate: { findMany: jest.Mock; findUnique: jest.Mock };
    inventoryItem: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
    };
    playerWeapon: { findFirst: jest.Mock; create: jest.Mock };
    skill: { findFirst: jest.Mock };
    playerSkill: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    transactionLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      player: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      itemTemplate: { findMany: jest.fn(), findUnique: jest.fn() },
      inventoryItem: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      playerWeapon: { findFirst: jest.fn(), create: jest.fn() },
      skill: { findFirst: jest.fn() },
      playerSkill: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      transactionLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: any) => any) =>
        Promise.resolve(cb(prisma)),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('unequips only items sharing the same ItemType so CHARACTER, CLOTHING, and COSMETIC stay equipped together', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.inventoryItem.findFirst.mockResolvedValue({
      id: 'inv-char-1',
      playerId: 'p1',
      template: { id: 'tpl-char', type: ItemType.CHARACTER },
    });
    prisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryItem.update.mockResolvedValue({
      id: 'inv-char-1',
      equipped: true,
    });

    const equipped = await service.equipItem('u1', 'inv-char-1');

    expect(equipped.equipped).toBe(true);
    expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
      where: {
        playerId: 'p1',
        equipped: true,
        template: { type: ItemType.CHARACTER },
      },
      data: { equipped: false },
    });
  });

  it('buys catalog items atomically in EUR and logs transaction', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      euros: 5000,
      vidaCoins: 0,
    });
    prisma.itemTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      name: 'Inhibidor GPS Portátil',
      type: ItemType.CONSUMABLE,
      priceEuros: 1500,
      priceVida: null,
      stats: { heatReduction: 20 },
    });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryItem.findFirst.mockResolvedValue(null);
    prisma.inventoryItem.create.mockResolvedValue({
      id: 'inv-1',
      quantity: 2,
      equipped: false,
    });
    prisma.transactionLog.create.mockResolvedValue({});

    const res = await service.buyCatalogItem('u1', 'tpl-1', 2, 'EUR');

    expect(res.totalCost).toBe(3000);
    expect(res.currency).toBe('EUR');
    expect(prisma.player.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1', euros: { gte: 3000 } },
        data: { euros: { decrement: 3000 } },
      }),
    );
  });

  it('unequips an equipped item and uses a consumable to reduce heat', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      heat: 45,
      xp: 100,
      level: 1,
    });
    prisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: 'inv-1',
      playerId: 'p1',
      equipped: true,
      template: { id: 'tpl-1', type: ItemType.CLOTHING, name: 'Chaqueta' },
    });
    prisma.inventoryItem.update.mockResolvedValue({
      id: 'inv-1',
      equipped: false,
    });

    const unequipped = await service.unequipItem('u1', 'inv-1');
    expect(unequipped.equipped).toBe(false);

    prisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: 'inv-cons-1',
      playerId: 'p1',
      quantity: 1,
      template: {
        id: 'tpl-gps',
        name: 'Inhibidor GPS',
        type: ItemType.CONSUMABLE,
        stats: { heatReduction: 20 },
      },
    });
    prisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryItem.deleteMany.mockResolvedValue({ count: 1 });
    prisma.player.update.mockResolvedValue({
      id: 'p1',
      heat: 25,
      xp: 125,
      level: 1,
    });

    const used = await service.useItem('u1', 'inv-cons-1');
    expect(used.used).toBe(true);
    expect(used.heat).toBe(25);
  });

  it('supports targetPlayerId for admin item grants', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'p-target' });
    prisma.itemTemplate.findUnique.mockResolvedValue({
      id: 'tpl-vip',
      name: 'Traje',
    });
    prisma.inventoryItem.findFirst.mockResolvedValue(null);
    prisma.inventoryItem.create.mockResolvedValue({
      id: 'inv-target',
      playerId: 'p-target',
      quantity: 3,
    });

    const added = await service.addItemToInventory(
      'u-admin',
      'tpl-vip',
      3,
      'p-target',
    );
    expect(prisma.player.findUnique).toHaveBeenCalledWith({
      where: { id: 'p-target' },
    });
    expect(added.playerId).toBe('p-target');
  });
});
