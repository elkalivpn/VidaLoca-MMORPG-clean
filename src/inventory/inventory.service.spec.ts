import { Test, TestingModule } from '@nestjs/testing';
import { ItemType } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: {
    player: { findUnique: jest.Mock };
    inventoryItem: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      player: { findUnique: jest.fn() },
      inventoryItem: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: any) => any) => cb(prisma)),
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
});
