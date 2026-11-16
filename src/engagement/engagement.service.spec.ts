import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EngagementService } from './engagement.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EngagementService', () => {
  let service: EngagementService;
  let prisma: {
    player: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
    };
    clan: {
      findMany: jest.Mock;
    };
    transactionLog: {
      create: jest.Mock;
      createMany: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      player: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      clan: {
        findMany: jest.fn(),
      },
      transactionLog: {
        create: jest.fn(),
        createMany: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(async (cb: (tx: any) => any) =>
      cb(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngagementService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EngagementService>(EngagementService);
  });

  it('auto-generates referralCode and returns status with 3 daily challenges', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      referralCode: null,
      loginStreak: 2,
      lastDailyClaimAt: null,
      isVip: false,
      vipExpiresAt: null,
      dailyChallengesDate: null,
      dailyChallengesProgress: null,
      user: { isGuest: true },
    });
    prisma.player.update.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      referralCode: 'VL-ABC123',
      loginStreak: 2,
      lastDailyClaimAt: null,
      isVip: false,
      vipExpiresAt: null,
      dailyChallengesDate: null,
      dailyChallengesProgress: null,
      user: { isGuest: true },
    });
    prisma.player.count.mockResolvedValue(4);

    const res = await service.getStatus('u1');

    expect(res.referralCode).toBe('VL-ABC123');
    expect(res.referralsCount).toBe(4);
    expect(res.isGuest).toBe(true);
    expect(res.canClaimDaily).toBe(true);
    expect(res.dailyChallenges).toHaveLength(3);
  });

  it('claims daily streak reward day 3 with VidaCoins and +25% VIP XP', async () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      xp: 100,
      level: 2,
      loginStreak: 2,
      lastDailyClaimAt: yesterday,
      isVip: true,
      vipExpiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    prisma.player.update.mockResolvedValue({
      euros: 1100,
      vidaCoins: 10,
      xp: 288,
      level: 3,
      loginStreak: 3,
    });
    prisma.transactionLog.create.mockResolvedValue({});

    const res = await service.claimDaily('u1');

    expect(res.day).toBe(3);
    expect(res.reward.euros).toBe(1000);
    expect(res.reward.vidaCoins).toBe(10);
    expect(res.reward.xp).toBe(Math.round(150 * 1.25));
  });

  it('rejects claiming daily reward before 20-hour cooldown', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      loginStreak: 1,
      lastDailyClaimAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    await expect(service.claimDaily('u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('caches leaderboards cleanly for 30s', async () => {
    prisma.player.findMany.mockResolvedValue([]);
    prisma.clan.findMany.mockResolvedValue([]);

    await service.getLeaderboards();
    await service.getLeaderboards();

    expect(prisma.clan.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns active hourly world event and recent activity', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      isVip: false,
      vipExpiresAt: null,
    });
    prisma.transactionLog.findFirst.mockResolvedValue(null);
    prisma.transactionLog.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        type: 'EARN',
        amount: 500,
        currency: 'EUR',
        reason: 'Venta P2P',
        createdAt: new Date(),
      },
    ]);

    const res = await service.getWorldEventStatus('u1');

    expect(res.event).toBeDefined();
    expect(res.participated).toBe(false);
    expect(res.recentActivity).toHaveLength(1);
  });

  it('grants VIP bonus on world event participation and blocks duplicate hourly claim', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      xp: 100,
      level: 2,
      isVip: true,
      vipExpiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.transactionLog.findFirst.mockResolvedValueOnce(null);
    prisma.player.update.mockResolvedValue({
      euros: 1000,
      vidaCoins: 5,
      xp: 220,
      level: 3,
    });
    prisma.transactionLog.create.mockResolvedValue({});

    const res = await service.participateInWorldEvent('u1');
    expect(res.vipBonusApplied).toBe(true);
    expect(res.reward.battlePassXp).toBe(40);
    expect(res.reward.vidaCoins).toBeGreaterThanOrEqual(3);

    prisma.transactionLog.findFirst.mockResolvedValueOnce({ id: 'already' });
    await expect(service.participateInWorldEvent('u1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
