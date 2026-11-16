import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

interface MockPrisma {
  user: { count: jest.Mock; update: jest.Mock };
  player: {
    count: jest.Mock;
    aggregate: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  marketListing: { count: jest.Mock };
  clan: { count: jest.Mock };
  securityAuditLog: { findMany: jest.Mock };
  transactionLog: { create: jest.Mock };
  $transaction: jest.Mock;
}

describe('AdminService', () => {
  let service: AdminService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = {
      user: {
        count: jest.fn(),
        update: jest.fn(),
      },
      player: {
        count: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      marketListing: {
        count: jest.fn(),
      },
      clan: {
        count: jest.fn(),
      },
      securityAuditLog: {
        findMany: jest.fn(),
      },
      transactionLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: MockPrisma) => Promise<unknown>) =>
        cb(prisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AdminService);
  });

  it('aggregates live metrics, recent players and security logs', async () => {
    prisma.user.count.mockResolvedValueOnce(50).mockResolvedValueOnce(12);
    prisma.player.count.mockResolvedValueOnce(48).mockResolvedValueOnce(7);
    prisma.marketListing.count.mockResolvedValue(9);
    prisma.clan.count.mockResolvedValue(4);
    prisma.player.aggregate.mockResolvedValue({
      _sum: { euros: 125000.4, vidaCoins: 4200 },
    });
    prisma.player.findMany.mockResolvedValue([
      { id: 'p1', displayName: 'Boss' },
    ]);
    prisma.securityAuditLog.findMany.mockResolvedValue([]);

    const res = await service.getOverview();

    expect(res.metrics.totalUsers).toBe(50);
    expect(res.metrics.guestUsers).toBe(12);
    expect(res.metrics.activeVipPlayers).toBe(7);
    expect(res.metrics.totalEurosInEconomy).toBe(125000);
    expect(res.recentPlayers).toHaveLength(1);
  });

  it('bans player and rotates tokenVersion to revoke active refresh tokens', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      displayName: 'Cheater',
    });
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      username: 'cheater',
      isBanned: true,
      banReason: 'Exploit',
    });

    const res = await service.setBanStatus('p1', {
      isBanned: true,
      reason: 'Exploit',
    });

    expect(res.user.isBanned).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          isBanned: true,
          banReason: 'Exploit',
          tokenVersion: { increment: 1 },
        },
      }),
    );
  });

  it('throws on grantVipAndCoins with 0 days and 0 coins, and grants VIP cleanly', async () => {
    await expect(service.grantVipAndCoins('p1', {})).rejects.toThrow(
      BadRequestException,
    );

    prisma.player.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.grantVipAndCoins('missing', { days: 7 }),
    ).rejects.toThrow(NotFoundException);

    prisma.player.findUnique.mockResolvedValueOnce({
      id: 'p1',
      isVip: false,
      vipExpiresAt: null,
      vidaCoins: 10,
    });
    prisma.player.update.mockResolvedValue({
      id: 'p1',
      displayName: 'Jugador',
      isVip: true,
      vipExpiresAt: new Date(Date.now() + 7 * 86_400_000),
      vidaCoins: 110,
    });

    const res = await service.grantVipAndCoins('p1', {
      days: 7,
      vidaCoins: 100,
    });
    expect(res.grantedDays).toBe(7);
    expect(res.grantedVidaCoins).toBe(100);
    expect(prisma.transactionLog.create).toHaveBeenCalled();
  });
});
