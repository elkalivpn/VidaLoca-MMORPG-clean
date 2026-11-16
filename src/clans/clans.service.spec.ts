import { BadRequestException } from '@nestjs/common';
import { ClansService } from './clans.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ClansService (Donations, Turf Shield & Territory Tax)', () => {
  let service: ClansService;
  let prisma: {
    player: { findUnique: jest.Mock; updateMany: jest.Mock };
    clanMember: { findUnique: jest.Mock };
    clan: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    territory: { findUnique: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
    clanTerritory: { findUnique: jest.Mock; deleteMany: jest.Mock; create: jest.Mock };
    transactionLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      player: { findUnique: jest.fn(), updateMany: jest.fn() },
      clanMember: { findUnique: jest.fn() },
      clan: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      territory: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
      clanTerritory: { findUnique: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
      transactionLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    service = new ClansService(prisma as unknown as PrismaService);
  });

  it('donateToClan atomically transfers euros from player to clan funds', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'p-1', euros: 2000 });
    prisma.clanMember.findUnique.mockResolvedValue({ playerId: 'p-1', clanId: 'c-1', role: 'MEMBER' });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    prisma.clan.update.mockResolvedValue({ id: 'c-1', tag: 'MAD', funds: 5500 });

    const res = await service.donateToClan('u-1', 500);
    expect(res).toEqual({ donated: 500, clanFunds: 5500 });
    expect(prisma.transactionLog.create).toHaveBeenCalledTimes(1);
  });

  it('claimTerritory blocks conquest during 2-hour post-capture protection shield', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'p-1' });
    prisma.clanMember.findUnique.mockResolvedValue({ playerId: 'p-1', clanId: 'c-1', role: 'LEADER' });
    prisma.territory.findUnique.mockResolvedValue({ id: 't-1', controllerId: 'c-2' });
    prisma.clan.findUnique.mockResolvedValue({ id: 'c-1', funds: 10000 });
    prisma.clanTerritory.findUnique.mockResolvedValue({
      territoryId: 't-1',
      clanId: 'c-2',
      capturedAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    await expect(service.claimTerritory('u-1', 't-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('collectTerritoryTax deposits incomeRate * 2 into clan funds and respects 4h cooldown', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'p-1' });
    prisma.clanMember.findUnique.mockResolvedValue({ playerId: 'p-1', clanId: 'c-1', role: 'OFFICER' });
    prisma.territory.findUnique.mockResolvedValue({
      id: 't-1',
      name: 'Puerto Banús',
      controllerId: 'c-1',
      incomeRate: 600,
    });
    prisma.territory.updateMany.mockResolvedValue({ count: 1 });
    prisma.clan.update.mockResolvedValue({ id: 'c-1', funds: 8200 });

    const res = await service.collectTerritoryTax('u-1', 't-1');
    expect(res).toEqual({
      territoryName: 'Puerto Banús',
      taxAmount: 1200,
      clanFunds: 8200,
    });

    prisma.territory.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.collectTerritoryTax('u-1', 't-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
