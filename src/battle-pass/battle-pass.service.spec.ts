import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BattlePassService } from './battle-pass.service';
import { PrismaService } from '../prisma/prisma.service';
import { BATTLE_PASS_PREMIUM_PRICE_VC } from '../common/utils/battle-pass.util';

describe('BattlePassService', () => {
  let service: BattlePassService;
  let prisma: any;

  const activeSeason = {
    id: 'season-1',
    seasonNumber: 1,
    name: 'Temporada 1: Ruta Ibérica e Insular',
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T00:00:00Z'),
    isActive: true,
  };

  const basePlayer = {
    id: 'player-1',
    userId: 'user-1',
    displayName: 'El Madrid',
    vidaCoins: 300,
    isVip: false,
    vipExpiresAt: null,
  };

  beforeEach(async () => {
    prisma = {
      player: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      battlePassSeason: {
        findFirst: jest.fn(),
      },
      battlePassProgress: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      transactionLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BattlePassService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(BattlePassService);
  });

  it('grants effectivePremium when player has active Club VIP', async () => {
    prisma.player.findUnique.mockResolvedValue({
      ...basePlayer,
      isVip: true,
      vipExpiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.battlePassSeason.findFirst.mockResolvedValue(activeSeason);
    prisma.battlePassProgress.findUnique.mockResolvedValue({
      id: 'bp-1',
      playerId: 'player-1',
      seasonId: 'season-1',
      level: 3,
      xp: 40,
      isPremium: false,
      rewardsClaimed: [],
      season: activeSeason,
    });

    const res = await service.getPlayerProgress('user-1');

    expect(res.hasClubVip).toBe(true);
    expect(res.effectivePremium).toBe(true);
    expect(res.premiumPriceVida).toBe(BATTLE_PASS_PREMIUM_PRICE_VC);
  });

  it('unlocks Premium Pass atomically with VidaCoins', async () => {
    prisma.player.findUnique.mockResolvedValue(basePlayer);
    prisma.battlePassSeason.findFirst.mockResolvedValue(activeSeason);
    prisma.battlePassProgress.findUnique.mockResolvedValue({
      id: 'bp-1',
      playerId: 'player-1',
      seasonId: 'season-1',
      level: 2,
      xp: 0,
      isPremium: false,
      rewardsClaimed: [],
    });
    prisma.player.updateMany.mockResolvedValue({ count: 1 });
    prisma.battlePassProgress.update.mockResolvedValue({
      id: 'bp-1',
      playerId: 'player-1',
      seasonId: 'season-1',
      level: 2,
      xp: 0,
      isPremium: true,
      rewardsClaimed: [],
      season: activeSeason,
    });

    const res = await service.unlockPremium('user-1');

    expect(res.vidaCoinsSpent).toBe(BATTLE_PASS_PREMIUM_PRICE_VC);
    expect(res.progress.isPremium).toBe(true);
    expect(prisma.transactionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currency: 'VIDACOIN',
          amount: BATTLE_PASS_PREMIUM_PRICE_VC,
        }),
      }),
    );
  });

  it('rejects unlockPremium when VidaCoins are insufficient', async () => {
    prisma.player.findUnique.mockResolvedValue({ ...basePlayer, vidaCoins: 50 });
    prisma.battlePassSeason.findFirst.mockResolvedValue(activeSeason);
    prisma.battlePassProgress.findUnique.mockResolvedValue({
      id: 'bp-1',
      playerId: 'player-1',
      seasonId: 'season-1',
      level: 1,
      xp: 0,
      isPremium: false,
      rewardsClaimed: [],
    });
    prisma.player.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.unlockPremium('user-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.battlePassProgress.update).not.toHaveBeenCalled();
  });

  it('grants Premium rewards for VIP players and prevents concurrent double claim', async () => {
    prisma.player.findUnique.mockResolvedValue({
      ...basePlayer,
      isVip: true,
      vipExpiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.battlePassSeason.findFirst.mockResolvedValue(activeSeason);
    prisma.battlePassProgress.findUnique.mockResolvedValue({
      id: 'bp-1',
      playerId: 'player-1',
      seasonId: 'season-1',
      level: 4,
      xp: 50,
      isPremium: false,
      rewardsClaimed: [1],
      season: activeSeason,
    });
    prisma.battlePassProgress.updateMany.mockResolvedValueOnce({ count: 1 });

    const res = await service.claimReward('user-1', 4);
    expect(res.effectivePremium).toBe(true);
    expect(res.reward).toEqual({ euros: 1000, vida: 20 });

    // Second concurrent attempt loses compare-and-swap lock
    prisma.battlePassProgress.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.claimReward('user-1', 4)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('grants Free tier rewards including milestone VidaCoins every 5 levels', async () => {
    prisma.player.findUnique.mockResolvedValue(basePlayer);
    prisma.battlePassSeason.findFirst.mockResolvedValue(activeSeason);
    prisma.battlePassProgress.findUnique.mockResolvedValue({
      id: 'bp-1',
      playerId: 'player-1',
      seasonId: 'season-1',
      level: 5,
      xp: 10,
      isPremium: false,
      rewardsClaimed: [],
      season: activeSeason,
    });
    prisma.battlePassProgress.updateMany.mockResolvedValue({ count: 1 });

    const res = await service.claimReward('user-1', 5);
    expect(res.effectivePremium).toBe(false);
    expect(res.reward).toEqual({ euros: 500, vida: 5 });
  });
});
