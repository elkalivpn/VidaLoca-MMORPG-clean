import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsService } from './achievements.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AchievementsService', () => {
  let service: AchievementsService;
  let prisma: {
    player: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    achievement: {
      findMany: jest.Mock;
    };
    playerAchievement: {
      findMany: jest.Mock;
      create: jest.Mock;
    };
    completedMission: {
      count: jest.Mock;
    };
    playerVehicle: {
      count: jest.Mock;
    };
    playerProperty: {
      count: jest.Mock;
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
      achievement: {
        findMany: jest.fn(),
      },
      playerAchievement: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      completedMission: {
        count: jest.fn(),
      },
      playerVehicle: {
        count: jest.fn(),
      },
      playerProperty: {
        count: jest.fn(),
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
        AchievementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
  });

  it('unlocks achievements across level, missions, vehicles, and properties conditions', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      level: 15,
      euros: 60000,
      reputation: 1200,
    });
    prisma.playerAchievement.findMany.mockResolvedValue([
      { achievementId: 'ach-already' },
    ]);
    prisma.achievement.findMany.mockResolvedValue([
      {
        id: 'ach-already',
        name: 'Already',
        condition: { type: 'reach_level', value: 1 },
        rewardVida: 1,
        rewardEuros: 100,
      },
      {
        id: 'ach-missions',
        name: 'Sicario',
        condition: { type: 'missions_completed', value: 10 },
        rewardVida: 10,
        rewardEuros: 5000,
      },
      {
        id: 'ach-vehicles',
        name: 'Garaje lleno',
        condition: { type: 'vehicles_owned', value: 3 },
        rewardVida: 15,
        rewardEuros: 7500,
      },
      {
        id: 'ach-props',
        name: 'Terrateniente',
        condition: { type: 'properties_owned', value: 5 },
        rewardVida: 25,
        rewardEuros: 20000,
      },
    ]);
    prisma.completedMission.count.mockResolvedValue(12);
    prisma.playerVehicle.count.mockResolvedValue(3);
    prisma.playerProperty.count.mockResolvedValue(1);
    prisma.playerAchievement.create.mockImplementation(
      async ({ data }: any) => ({
        id: `pa-${data.achievementId}`,
        achievementId: data.achievementId,
        achievement: { id: data.achievementId },
      }),
    );
    prisma.player.update.mockResolvedValue({});
    prisma.transactionLog.create.mockResolvedValue({});

    const unlocked = await service.checkAndUnlock('u1');

    expect(unlocked).toHaveLength(2);
    expect(unlocked.map((u) => u.achievementId)).toEqual([
      'ach-missions',
      'ach-vehicles',
    ]);
    expect(prisma.completedMission.count).toHaveBeenCalledTimes(1);
    expect(prisma.playerVehicle.count).toHaveBeenCalledTimes(1);
    expect(prisma.playerProperty.count).toHaveBeenCalledTimes(1);
  });

  it('ignores P2002 unique constraint races cleanly without throwing', async () => {
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      level: 5,
      euros: 0,
      reputation: 0,
    });
    prisma.playerAchievement.findMany.mockResolvedValue([]);
    prisma.achievement.findMany.mockResolvedValue([
      {
        id: 'ach-lvl',
        name: 'Nivel 5',
        condition: { type: 'reach_level', value: 5 },
        rewardVida: 5,
        rewardEuros: 500,
      },
    ]);
    prisma.playerAchievement.create.mockRejectedValue({ code: 'P2002' });

    const unlocked = await service.checkAndUnlock('u1');
    expect(unlocked).toEqual([]);
  });
});
