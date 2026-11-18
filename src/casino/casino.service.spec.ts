import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CasinoService, PlayingCard } from './casino.service';
import { PrismaService } from '../prisma/prisma.service';
import { AntiCheatService } from '../security/anti-cheat.service';

describe('CasinoService', () => {
  let service: CasinoService;
  let prisma: {
    player: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    transactionLog: {
      findMany: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let antiCheat: {
    assertFinitePositive: jest.Mock;
    assertActionCooldown: jest.Mock;
  };

  const basePlayer = {
    id: 'player-1',
    userId: 'user-1',
    displayName: 'El Rubio',
    euros: 5000,
    vidaCoins: 25,
    isVip: false,
    heat: 15,
    level: 1,
    xp: 100,
    jailUntil: null as Date | null,
  };

  beforeEach(async () => {
    prisma = {
      player: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      transactionLog: {
        findMany: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      (cb: (tx: typeof prisma) => unknown) => Promise.resolve(cb(prisma)),
    );

    antiCheat = {
      assertFinitePositive: jest.fn((v: number) => v),
      assertActionCooldown: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasinoService,
        { provide: PrismaService, useValue: prisma },
        { provide: AntiCheatService, useValue: antiCheat },
      ],
    }).compile();

    service = module.get<CasinoService>(CasinoService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('getStatus', () => {
    it('returns casino limits, player snapshot, and recent CASINO: plays', async () => {
      const logs = [{ id: 'log-1', reason: 'CASINO:ROULETTE', amount: 100 }];
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.transactionLog.findMany.mockResolvedValue(logs);

      const res = await service.getStatus('user-1');

      expect(res.minBet).toBe(10);
      expect(res.maxBet).toBe(25000);
      expect(res.vipMaxBet).toBe(100000);
      expect(res.player).toEqual({
        euros: 5000,
        vidaCoins: 25,
        isVip: false,
        heat: 15,
        level: 1,
      });
      expect(res.recentPlays).toEqual(logs);
      expect(prisma.transactionLog.findMany).toHaveBeenCalledWith({
        where: {
          playerId: 'player-1',
          reason: { startsWith: 'CASINO:' },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });

    it('throws NotFoundException when player does not exist', async () => {
      prisma.player.findUnique.mockResolvedValue(null);
      await expect(service.getStatus('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('playRoulette', () => {
    it('throws BadRequestException on atomic debit failure (insufficient euros)', async () => {
      prisma.player.findUnique.mockResolvedValue({ ...basePlayer, euros: 50 });
      prisma.player.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.playRoulette('user-1', { bet: 100, betType: 'RED' }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.player.update).not.toHaveBeenCalled();
      expect(prisma.transactionLog.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when player is jailed', async () => {
      prisma.player.findUnique.mockResolvedValue({
        ...basePlayer,
        jailUntil: new Date(Date.now() + 60_000),
      });

      await expect(
        service.playRoulette('user-1', { bet: 100, betType: 'RED' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.player.updateMany).not.toHaveBeenCalled();
    });

    it('enforces maxBet 25000 for non-VIP and allows up to 100000 for VIP', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);

      await expect(
        service.playRoulette('user-1', { bet: 30000, betType: 'RED' }),
      ).rejects.toThrow(BadRequestException);

      prisma.player.findUnique.mockResolvedValue({
        ...basePlayer,
        isVip: true,
        euros: 200000,
      });
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        euros: 100000,
        xp: 106,
        level: 1,
      });
      // roll 2 (BLACK) -> loses RED
      jest.spyOn(Math, 'random').mockReturnValue(2 / 37);

      const vipRes = await service.playRoulette('user-1', {
        bet: 100000,
        betType: 'RED',
      });
      expect(vipRes.won).toBe(false);
      expect(vipRes.payout).toBe(0);
    });

    it('requires number when betType is NUMBER', async () => {
      await expect(
        service.playRoulette('user-1', { bet: 50, betType: 'NUMBER' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('pays 36x on winning NUMBER bet and awards 18 XP with level-up', async () => {
      const nearLevelPlayer = { ...basePlayer, xp: 990, level: 1, euros: 1000 };
      prisma.player.findUnique.mockResolvedValue(nearLevelPlayer);
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockImplementation(
        ({
          data,
        }: {
          data: { euros?: { increment?: number }; xp: number; level: number };
        }) =>
          Promise.resolve({
            ...nearLevelPlayer,
            euros: 900 + (data.euros?.increment ?? 0),
            xp: data.xp,
            level: data.level,
          }),
      );

      // roll = 17 (Math.floor(0.46 * 37) = 17)
      jest.spyOn(Math, 'random').mockReturnValue(17.1 / 37);

      const res = await service.playRoulette('user-1', {
        bet: 100,
        betType: 'NUMBER',
        number: 17,
      });

      expect(antiCheat.assertActionCooldown).toHaveBeenCalledWith(
        'user-1',
        'casino_bet',
        350,
      );
      expect(res.won).toBe(true);
      expect(res.resultNumber).toBe(17);
      expect(res.resultColor).toBe('BLACK');
      expect(res.multiplier).toBe(36);
      expect(res.payout).toBe(3600);
      expect(res.xpDelta).toBe(18);
      expect(res.player.level).toBe(2);
      expect(prisma.transactionLog.create).toHaveBeenCalledTimes(2);
    });

    it('pays 36x on GREEN (0) and 2x on RED/EVEN', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        euros: 8500,
        xp: 118,
        level: 1,
      });

      // roll 0 -> GREEN
      jest.spyOn(Math, 'random').mockReturnValue(0.0);
      const greenRes = await service.playRoulette('user-1', {
        bet: 100,
        betType: 'GREEN',
      });
      expect(greenRes.won).toBe(true);
      expect(greenRes.resultColor).toBe('GREEN');
      expect(greenRes.payout).toBe(3600);

      // roll 12 -> RED & EVEN
      jest.spyOn(Math, 'random').mockReturnValue(12.2 / 37);
      const evenRes = await service.playRoulette('user-1', {
        bet: 100,
        betType: 'EVEN',
      });
      expect(evenRes.won).toBe(true);
      expect(evenRes.resultColor).toBe('RED');
      expect(evenRes.payout).toBe(200);
    });
  });

  describe('playDice', () => {
    it('pays 4.5x on SEVEN when total is 7', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        euros: 5350,
        xp: 118,
        level: 1,
      });

      // die1 = 3, die2 = 4 => total 7
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(2 / 6)
        .mockReturnValueOnce(3 / 6);

      const res = await service.playDice('user-1', {
        bet: 100,
        choice: 'SEVEN',
      });

      expect(res.won).toBe(true);
      expect(res.dice).toEqual([3, 4]);
      expect(res.total).toBe(7);
      expect(res.multiplier).toBe(4.5);
      expect(res.payout).toBe(450);
      expect(prisma.transactionLog.create).toHaveBeenCalledWith({
        data: {
          playerId: 'player-1',
          type: 'EARN',
          amount: 450,
          currency: 'EUR',
          reason: 'CASINO:DICE',
          reference: 'WIN:SEVEN:7',
        },
      });
    });

    it('pays 2x on HIGH (>7) and handles LOW (<7) loss', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        euros: 5100,
        xp: 118,
        level: 1,
      });

      // die1 = 5, die2 = 6 => 11
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(4 / 6)
        .mockReturnValueOnce(5 / 6);

      const highWin = await service.playDice('user-1', {
        bet: 100,
        choice: 'HIGH',
      });
      expect(highWin.won).toBe(true);
      expect(highWin.payout).toBe(200);

      // die1 = 4, die2 = 4 => 8 (LOW loses)
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(3 / 6)
        .mockReturnValueOnce(3 / 6);

      const lowLoss = await service.playDice('user-1', {
        bet: 100,
        choice: 'LOW',
      });
      expect(lowLoss.won).toBe(false);
      expect(lowLoss.payout).toBe(0);
    });

    it('throws BadRequestException when euros insufficient for dice', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.player.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.playDice('user-1', { bet: 500, choice: 'HIGH' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Blackjack', () => {
    const card = (rank: string, value: number, suit = '♠'): PlayingCard => ({
      rank,
      suit,
      value,
    });

    it('throws BadRequestException when starting blackjack with insufficient euros', async () => {
      prisma.player.findUnique.mockResolvedValue({ ...basePlayer, euros: 20 });
      prisma.player.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.startBlackjack('user-1', { bet: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('resolves natural Blackjack immediately at 2.5x payout', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        euros: 5150,
        xp: 124,
        level: 1,
      });

      // drawCard pops from end of deck
      jest.spyOn(service as any, 'createShuffledDeck').mockReturnValue([
        card('2', 2),
        card('9', 9), // dealer 2nd
        card('8', 8), // dealer 1st
        card('K', 10), // player 2nd
        card('A', 11), // player 1st
      ]);

      const res = await service.startBlackjack('user-1', { bet: 100 });

      expect(res.status).toBe('PLAYER_BLACKJACK');
      expect(res.handId).toBeNull();
      expect(res.playerScore).toBe(21);
      expect(res.payout).toBe(250);
    });

    it('hides dealer second card while PLAYING and supports HIT -> BUST', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        euros: 4900,
        xp: 106,
        level: 1,
      });

      // Deck (popped from end): p1=10, p2=6 (16), d1=9, d2=7, hit1=4 (20), hit2=5 (25 BUST)
      jest
        .spyOn(service as any, 'createShuffledDeck')
        .mockReturnValue([
          card('5', 5),
          card('4', 4),
          card('7', 7),
          card('9', 9),
          card('6', 6),
          card('10', 10),
        ]);

      const start = await service.startBlackjack('user-1', { bet: 100 });
      expect(start.status).toBe('PLAYING');
      expect(start.handId).toBeTruthy();
      expect(start.dealerCards[1]).toEqual({ rank: '?', suit: '♠', value: 0 });
      expect(start.playerScore).toBe(16);

      // Ownership check
      await expect(
        service.blackjackAction('other-user', {
          handId: start.handId!,
          action: 'HIT',
        }),
      ).rejects.toThrow(ForbiddenException);

      // HIT -> 20 (still PLAYING)
      const hit1 = await service.blackjackAction('user-1', {
        handId: start.handId!,
        action: 'HIT',
      });
      expect(hit1.status).toBe('PLAYING');
      expect(hit1.playerScore).toBe(20);

      // HIT -> 25 (BUST)
      const hit2 = await service.blackjackAction('user-1', {
        handId: start.handId!,
        action: 'HIT',
      });
      expect(hit2.status).toBe('BUST');
      expect(hit2.playerScore).toBe(25);
      expect(hit2.payout).toBe(0);

      // Hand deleted after BUST
      await expect(
        service.blackjackAction('user-1', {
          handId: start.handId!,
          action: 'STAND',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('calculates Ace as 11 or 1 correctly and resolves STAND against dealer drawing to 17+', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        euros: 5100,
        xp: 120,
        level: 1,
      });

      // p1=A(11), p2=7 (18), d1=10, d2=5 (15), dealerDraw=2 (17)
      jest
        .spyOn(service as any, 'createShuffledDeck')
        .mockReturnValue([
          card('2', 2),
          card('5', 5),
          card('10', 10),
          card('7', 7),
          card('A', 11),
        ]);

      const start = await service.startBlackjack('user-1', { bet: 100 });
      expect(start.playerScore).toBe(18);

      const stand = await service.blackjackAction('user-1', {
        handId: start.handId!,
        action: 'STAND',
      });
      expect(stand.status).toBe('PLAYER_WIN');
      expect(stand.dealerScore).toBe(17);
      expect(stand.payout).toBe(200);
    });

    it('supports DOUBLE with atomic second debit and resolves dealer turn', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        euros: 5200,
        xp: 120,
        level: 1,
      });

      // p1=5, p2=6 (11), d1=10, d2=8 (18), doubleCard=9 (20)
      jest
        .spyOn(service as any, 'createShuffledDeck')
        .mockReturnValue([
          card('9', 9),
          card('8', 8),
          card('10', 10),
          card('6', 6),
          card('5', 5),
        ]);

      const start = await service.startBlackjack('user-1', { bet: 100 });
      const dbl = await service.blackjackAction('user-1', {
        handId: start.handId!,
        action: 'DOUBLE',
      });

      expect(dbl.status).toBe('PLAYER_WIN');
      expect(dbl.bet).toBe(200);
      expect(dbl.playerScore).toBe(20);
      expect(dbl.dealerScore).toBe(18);
      expect(dbl.payout).toBe(400);
    });

    it('keeps hand intact and throws BadRequestException if DOUBLE fails due to insufficient euros', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      // First debit succeeds (start), second debit fails (double)
      prisma.player.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        euros: 5100,
        xp: 120,
        level: 1,
      });

      jest
        .spyOn(service as any, 'createShuffledDeck')
        .mockReturnValue([
          card('9', 9),
          card('7', 7),
          card('10', 10),
          card('9', 9),
          card('10', 10),
        ]);

      const start = await service.startBlackjack('user-1', { bet: 100 });

      await expect(
        service.blackjackAction('user-1', {
          handId: start.handId!,
          action: 'DOUBLE',
        }),
      ).rejects.toThrow(BadRequestException);

      // Player can still STAND after failed DOUBLE
      const stand = await service.blackjackAction('user-1', {
        handId: start.handId!,
        action: 'STAND',
      });
      expect(stand.status).toBe('PLAYER_WIN');
      expect(stand.payout).toBe(200);
    });

    it('cleans up stale blackjack hands older than 15 minutes', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      jest
        .spyOn(service as any, 'createShuffledDeck')
        .mockReturnValue([
          card('5', 5),
          card('7', 7),
          card('10', 10),
          card('8', 8),
          card('6', 6),
        ]);

      const start = await service.startBlackjack('user-1', { bet: 100 });
      expect(start.handId).toBeTruthy();

      // Advance 16 minutes
      jest.advanceTimersByTime(16 * 60 * 1000);

      await expect(
        service.blackjackAction('user-1', {
          handId: start.handId!,
          action: 'STAND',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Dual Currency (VIDACOIN)', () => {
    it('returns VC betting limits in getStatus alongside EUR limits', async () => {
      prisma.player.findUnique.mockResolvedValue(basePlayer);
      prisma.transactionLog.findMany.mockResolvedValue([]);

      const res = await service.getStatus('user-1');

      expect(res.minBetVc).toBe(1);
      expect(res.maxBetVc).toBe(500);
      expect(res.vipMaxBetVc).toBe(2000);
    });

    it('rejects fractional VidaCoins bets and debits/credits vidaCoins atomically on Roulette', async () => {
      prisma.player.findUnique.mockResolvedValue({
        ...basePlayer,
        vidaCoins: 20,
      });

      await expect(
        service.playRoulette('user-1', {
          bet: 1.5,
          betType: 'RED',
          currency: 'VIDACOIN',
        }),
      ).rejects.toThrow(BadRequestException);

      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        vidaCoins: 30,
        xp: 118,
        level: 1,
      });
      // roll 1 -> RED
      jest.spyOn(Math, 'random').mockReturnValue(1.1 / 37);

      const res = await service.playRoulette('user-1', {
        bet: 10,
        betType: 'RED',
        currency: 'VIDACOIN',
      });

      expect(res.currency).toBe('VIDACOIN');
      expect(res.won).toBe(true);
      expect(res.payout).toBe(20);
      expect(res.netProfit).toBe(10);
      expect(prisma.player.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', vidaCoins: { gte: 10 } },
        data: { vidaCoins: { decrement: 10 } },
      });
      const createCalls = prisma.transactionLog.create.mock.calls as Array<
        [{ data: Record<string, unknown> }]
      >;
      expect(
        createCalls.some(
          ([arg]) =>
            arg.data.type === 'EARN' &&
            arg.data.amount === 20 &&
            arg.data.currency === 'VIDACOIN' &&
            arg.data.reason === 'CASINO:ROULETTE',
        ),
      ).toBe(true);
    });

    it('rounds up integer VC payouts cleanly on Dice SEVEN (1 VC -> 5 VC) and Blackjack 3:2', async () => {
      prisma.player.findUnique.mockResolvedValue({
        ...basePlayer,
        vidaCoins: 10,
      });
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        vidaCoins: 14,
        xp: 118,
        level: 1,
      });

      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(2 / 6)
        .mockReturnValueOnce(3 / 6);

      const diceRes = await service.playDice('user-1', {
        bet: 1,
        choice: 'SEVEN',
        currency: 'VIDACOIN',
      });
      expect(diceRes.currency).toBe('VIDACOIN');
      expect(diceRes.payout).toBe(5);

      const card = (rank: string, value: number, suit = '♠'): PlayingCard => ({
        rank,
        suit,
        value,
      });
      jest
        .spyOn(service as any, 'createShuffledDeck')
        .mockReturnValue([
          card('2', 2),
          card('9', 9),
          card('8', 8),
          card('K', 10),
          card('A', 11),
        ]);
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        vidaCoins: 12,
        xp: 124,
        level: 1,
      });

      const bjNatural = await service.startBlackjack('user-1', {
        bet: 1,
        currency: 'VIDACOIN',
      });
      expect(bjNatural.currency).toBe('VIDACOIN');
      expect(bjNatural.status).toBe('PLAYER_BLACKJACK');
      expect(bjNatural.payout).toBe(3);
    });

    it('supports Blackjack DOUBLE in VIDACOIN and debits extra vidaCoins atomically', async () => {
      const card = (rank: string, value: number, suit = '♠'): PlayingCard => ({
        rank,
        suit,
        value,
      });
      prisma.player.findUnique.mockResolvedValue({
        ...basePlayer,
        vidaCoins: 20,
      });
      prisma.player.updateMany.mockResolvedValue({ count: 1 });
      prisma.player.update.mockResolvedValue({
        ...basePlayer,
        vidaCoins: 30,
        xp: 120,
        level: 1,
      });

      jest
        .spyOn(service as any, 'createShuffledDeck')
        .mockReturnValue([
          card('9', 9),
          card('8', 8),
          card('10', 10),
          card('6', 6),
          card('5', 5),
        ]);

      const start = await service.startBlackjack('user-1', {
        bet: 5,
        currency: 'VIDACOIN',
      });
      expect(start.currency).toBe('VIDACOIN');

      const dbl = await service.blackjackAction('user-1', {
        handId: start.handId!,
        action: 'DOUBLE',
      });
      expect(dbl.currency).toBe('VIDACOIN');
      expect(dbl.status).toBe('PLAYER_WIN');
      expect(dbl.bet).toBe(10);
      expect(dbl.payout).toBe(20);
      expect(prisma.player.updateMany).toHaveBeenLastCalledWith({
        where: { userId: 'user-1', vidaCoins: { gte: 5 } },
        data: { vidaCoins: { decrement: 5 } },
      });
    });
  });
});
