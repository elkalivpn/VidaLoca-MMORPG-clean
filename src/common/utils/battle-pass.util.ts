import type { BattlePassProgress, Prisma } from '@prisma/client';

export const BATTLE_PASS_XP_PER_LEVEL = 200;
export const BATTLE_PASS_MAX_LEVEL = 100;
export const BATTLE_PASS_PREMIUM_PRICE_VC = 200;

export function calculateBattlePassReward(level: number, isPremium: boolean) {
  if (isPremium) {
    return {
      euros: level * 250,
      vida: level * 5,
    };
  }
  return {
    euros: level * 100,
    vida: level % 5 === 0 ? 5 : 0,
  };
}

export async function grantBattlePassXpTx(
  tx: Partial<
    Pick<Prisma.TransactionClient, 'battlePassProgress' | 'battlePassSeason'>
  >,
  playerId: string,
  amount: number,
): Promise<BattlePassProgress | null> {
  if (!tx?.battlePassProgress || amount <= 0) return null;

  let progress = await tx.battlePassProgress.findUnique({
    where: { playerId },
  });

  if (!progress) {
    const activeSeason = tx.battlePassSeason?.findFirst
      ? await tx.battlePassSeason.findFirst({ where: { isActive: true } })
      : null;
    if (!activeSeason || !tx.battlePassProgress.create) {
      return null;
    }
    progress = await tx.battlePassProgress.create({
      data: {
        playerId,
        seasonId: activeSeason.id,
        level: 1,
        xp: 0,
        isPremium: false,
        rewardsClaimed: [],
      },
    });
  }

  let newLevel = progress.level;
  let remaining = progress.xp + Math.round(amount);

  while (
    remaining >= BATTLE_PASS_XP_PER_LEVEL &&
    newLevel < BATTLE_PASS_MAX_LEVEL
  ) {
    remaining -= BATTLE_PASS_XP_PER_LEVEL;
    newLevel += 1;
  }

  if (newLevel >= BATTLE_PASS_MAX_LEVEL) {
    remaining = Math.min(remaining, BATTLE_PASS_XP_PER_LEVEL - 1);
  }

  return tx.battlePassProgress.update({
    where: progress.id ? { id: progress.id } : { playerId },
    data: {
      xp: remaining,
      level: newLevel,
    },
  });
}
