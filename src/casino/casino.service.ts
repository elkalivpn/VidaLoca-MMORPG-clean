import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AntiCheatService } from '../security/anti-cheat.service';
import { calculateLevelFromXp } from '../common/utils/level.util';
import { grantBattlePassXpTx } from '../common/utils/battle-pass.util';
import {
  BlackjackActionDto,
  BlackjackStartDto,
  DiceBetDto,
  RouletteBetDto,
} from './dto/casino.dto';

export interface PlayingCard {
  rank: string;
  suit: string;
  value: number;
}

export interface BlackjackHand {
  handId: string;
  userId: string;
  playerId: string;
  bet: number;
  deck: PlayingCard[];
  playerCards: PlayingCard[];
  dealerCards: PlayingCard[];
  createdAt: number;
  inFlight?: boolean;
}

const RED_ROULETTE_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const RANKS = [
  { rank: 'A', value: 11 },
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 10 },
  { rank: 'Q', value: 10 },
  { rank: 'K', value: 10 },
] as const;

@Injectable()
export class CasinoService {
  private static readonly MIN_BET = 10;
  private static readonly MAX_BET = 25000;
  private static readonly VIP_MAX_BET = 100000;
  private static readonly HAND_TTL_MS = 15 * 60 * 1000;

  private readonly blackjackHands = new Map<string, BlackjackHand>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly antiCheat?: AntiCheatService,
  ) {}

  private assertNotJailed(jailUntil?: Date | null): void {
    if (jailUntil && new Date(jailUntil).getTime() > Date.now()) {
      const remainingSec = Math.ceil(
        (new Date(jailUntil).getTime() - Date.now()) / 1000,
      );
      throw new ForbiddenException(
        `Estás en el calabozo (${remainingSec}s restantes). No puedes entrar al casino ahora.`,
      );
    }
  }

  private normalizeAndValidateBet(rawBet: number, isVip: boolean): number {
    this.antiCheat?.assertFinitePositive(
      rawBet,
      'bet',
      CasinoService.VIP_MAX_BET,
    );
    if (!Number.isFinite(rawBet) || rawBet < CasinoService.MIN_BET) {
      throw new BadRequestException(
        `La apuesta mínima es de ${CasinoService.MIN_BET}€`,
      );
    }
    const maxAllowed = isVip
      ? CasinoService.VIP_MAX_BET
      : CasinoService.MAX_BET;
    if (rawBet > maxAllowed) {
      throw new BadRequestException(
        `Tu límite máximo de apuesta es de ${maxAllowed}€${isVip ? '' : ' (VIP hasta 100.000€)'}`,
      );
    }
    return Math.round(rawBet * 100) / 100;
  }

  private cleanupStaleHands(now = Date.now()): void {
    for (const [handId, hand] of this.blackjackHands.entries()) {
      if (now - hand.createdAt > CasinoService.HAND_TTL_MS) {
        this.blackjackHands.delete(handId);
      }
    }
  }

  private createShuffledDeck(): PlayingCard[] {
    const deck: PlayingCard[] = [];
    for (const suit of SUITS) {
      for (const r of RANKS) {
        deck.push({ rank: r.rank, suit, value: r.value });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    return deck;
  }

  private drawCard(deck: PlayingCard[]): PlayingCard {
    const card = deck.pop();
    if (card) return card;
    const fresh = this.createShuffledDeck();
    deck.push(...fresh);
    return deck.pop()!;
  }

  private calculateHandScore(cards: PlayingCard[]): number {
    let total = 0;
    let aces = 0;
    for (const card of cards) {
      if (card.rank === 'A') {
        aces += 1;
        total += 11;
      } else {
        total += card.value;
      }
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }

  async getStatus(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const recentPlays = await this.prisma.transactionLog.findMany({
      where: {
        playerId: player.id,
        reason: { startsWith: 'CASINO:' },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      minBet: CasinoService.MIN_BET,
      maxBet: CasinoService.MAX_BET,
      vipMaxBet: CasinoService.VIP_MAX_BET,
      player: {
        euros: player.euros,
        vidaCoins: player.vidaCoins,
        isVip: player.isVip,
        heat: player.heat,
        level: player.level,
      },
      recentPlays,
    };
  }

  async playRoulette(userId: string, dto: RouletteBetDto) {
    if (
      dto.betType === 'NUMBER' &&
      (dto.number === undefined || dto.number === null)
    ) {
      throw new BadRequestException(
        'Debes indicar un número (0-36) cuando apuestas a NUMBER',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) {
        throw new NotFoundException('Player not found');
      }
      this.assertNotJailed(player.jailUntil);

      const bet = this.normalizeAndValidateBet(dto.bet, player.isVip);
      this.antiCheat?.assertActionCooldown(userId, 'casino_bet', 350);

      const debited = await tx.player.updateMany({
        where: { userId, euros: { gte: bet } },
        data: { euros: { decrement: bet } },
      });
      if (debited.count === 0) {
        throw new BadRequestException(
          `No tienes suficientes euros para apostar ${bet}€`,
        );
      }

      const roll = Math.floor(Math.random() * 37); // 0..36
      const color: 'GREEN' | 'RED' | 'BLACK' =
        roll === 0 ? 'GREEN' : RED_ROULETTE_NUMBERS.has(roll) ? 'RED' : 'BLACK';

      let won = false;
      let multiplier = 0;

      switch (dto.betType) {
        case 'NUMBER':
          won = roll === dto.number;
          multiplier = won ? 36 : 0;
          break;
        case 'GREEN':
          won = roll === 0;
          multiplier = won ? 36 : 0;
          break;
        case 'RED':
          won = color === 'RED';
          multiplier = won ? 2 : 0;
          break;
        case 'BLACK':
          won = color === 'BLACK';
          multiplier = won ? 2 : 0;
          break;
        case 'EVEN':
          won = roll !== 0 && roll % 2 === 0;
          multiplier = won ? 2 : 0;
          break;
        case 'ODD':
          won = roll % 2 === 1;
          multiplier = won ? 2 : 0;
          break;
      }

      const payout = won ? Math.round(bet * multiplier * 100) / 100 : 0;
      const xpDelta = won ? 18 : 6;
      const newXp = player.xp + xpDelta;
      const calculatedLevel = calculateLevelFromXp(newXp);
      const newLevel =
        calculatedLevel > player.level ? calculatedLevel : player.level;

      const updatedPlayer = await tx.player.update({
        where: { id: player.id },
        data: {
          ...(payout > 0 ? { euros: { increment: payout } } : {}),
          xp: newXp,
          level: newLevel,
        },
      });
      await grantBattlePassXpTx(tx, player.id, xpDelta);

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'SPEND',
          amount: bet,
          currency: 'EUR',
          reason: 'CASINO:ROULETTE',
          reference: `${dto.betType}:${roll}`,
        },
      });

      if (payout > 0) {
        await tx.transactionLog.create({
          data: {
            playerId: player.id,
            type: 'EARN',
            amount: payout,
            currency: 'EUR',
            reason: 'CASINO:ROULETTE',
            reference: `WIN:${dto.betType}:${roll}`,
          },
        });
      }

      const colorLabel =
        color === 'RED' ? 'Rojo' : color === 'GREEN' ? 'Verde' : 'Negro';
      const netProfit = Math.round((payout - bet) * 100) / 100;
      const narrative = won
        ? `La bola cae en el ${roll} (${colorLabel}). ¡Pleno en la mesa! Cobras ${payout.toLocaleString('es-ES')} €.`
        : `La bola cae en el ${roll} (${colorLabel}). La banca recoge tus ${bet.toLocaleString('es-ES')} €.`;

      return {
        game: 'ROULETTE' as const,
        won,
        bet,
        betType: dto.betType,
        chosenNumber: dto.number ?? null,
        resultNumber: roll,
        outcomeNumber: roll,
        resultColor: color,
        color,
        multiplier,
        payout,
        netProfit,
        net: netProfit,
        xpDelta,
        xpGained: xpDelta,
        narrative,
        player: {
          euros: updatedPlayer.euros,
          xp: updatedPlayer.xp,
          level: updatedPlayer.level,
        },
      };
    });
  }

  async playDice(userId: string, dto: DiceBetDto) {
    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) {
        throw new NotFoundException('Player not found');
      }
      this.assertNotJailed(player.jailUntil);

      const bet = this.normalizeAndValidateBet(dto.bet, player.isVip);
      this.antiCheat?.assertActionCooldown(userId, 'casino_bet', 350);

      const debited = await tx.player.updateMany({
        where: { userId, euros: { gte: bet } },
        data: { euros: { decrement: bet } },
      });
      if (debited.count === 0) {
        throw new BadRequestException(
          `No tienes suficientes euros para apostar ${bet}€`,
        );
      }

      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      const total = die1 + die2;

      let won = false;
      let multiplier = 0;

      if (dto.choice === 'HIGH') {
        won = total > 7;
        multiplier = won ? 2 : 0;
      } else if (dto.choice === 'LOW') {
        won = total < 7;
        multiplier = won ? 2 : 0;
      } else if (dto.choice === 'SEVEN') {
        won = total === 7;
        multiplier = won ? 4.5 : 0;
      }

      const payout = won ? Math.round(bet * multiplier * 100) / 100 : 0;
      const xpDelta = won ? 18 : 6;
      const newXp = player.xp + xpDelta;
      const calculatedLevel = calculateLevelFromXp(newXp);
      const newLevel =
        calculatedLevel > player.level ? calculatedLevel : player.level;

      const updatedPlayer = await tx.player.update({
        where: { id: player.id },
        data: {
          ...(payout > 0 ? { euros: { increment: payout } } : {}),
          xp: newXp,
          level: newLevel,
        },
      });
      await grantBattlePassXpTx(tx, player.id, xpDelta);

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'SPEND',
          amount: bet,
          currency: 'EUR',
          reason: 'CASINO:DICE',
          reference: `${dto.choice}:${die1}+${die2}`,
        },
      });

      if (payout > 0) {
        await tx.transactionLog.create({
          data: {
            playerId: player.id,
            type: 'EARN',
            amount: payout,
            currency: 'EUR',
            reason: 'CASINO:DICE',
            reference: `WIN:${dto.choice}:${total}`,
          },
        });
      }

      const netProfit = Math.round((payout - bet) * 100) / 100;
      const narrative = won
        ? `Los dados marcan ${die1} + ${die2} = ${total}. ¡Tirada ganadora! Cobras ${payout.toLocaleString('es-ES')} €.`
        : `Los dados marcan ${die1} + ${die2} = ${total}. La mesa se queda la apuesta.`;

      return {
        game: 'DICE' as const,
        won,
        bet,
        choice: dto.choice,
        die1,
        die2,
        dice: [die1, die2] as [number, number],
        total,
        multiplier,
        payout,
        netProfit,
        net: netProfit,
        xpDelta,
        xpGained: xpDelta,
        narrative,
        player: {
          euros: updatedPlayer.euros,
          xp: updatedPlayer.xp,
          level: updatedPlayer.level,
        },
      };
    });
  }

  async startBlackjack(userId: string, dto: BlackjackStartDto) {
    this.cleanupStaleHands();

    return this.prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { userId } });
      if (!player) {
        throw new NotFoundException('Player not found');
      }
      this.assertNotJailed(player.jailUntil);

      const bet = this.normalizeAndValidateBet(dto.bet, player.isVip);
      this.antiCheat?.assertActionCooldown(userId, 'casino_bet', 350);

      const debited = await tx.player.updateMany({
        where: { userId, euros: { gte: bet } },
        data: { euros: { decrement: bet } },
      });
      if (debited.count === 0) {
        throw new BadRequestException(
          `No tienes suficientes euros para apostar ${bet}€`,
        );
      }

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'SPEND',
          amount: bet,
          currency: 'EUR',
          reason: 'CASINO:BLACKJACK',
          reference: 'START',
        },
      });

      const deck = this.createShuffledDeck();
      const playerCards = [this.drawCard(deck), this.drawCard(deck)];
      const dealerCards = [this.drawCard(deck), this.drawCard(deck)];

      const playerScore = this.calculateHandScore(playerCards);
      const dealerScore = this.calculateHandScore(dealerCards);

      // Natural 21 resolution
      if (playerScore === 21) {
        const isPush = dealerScore === 21;
        const status = isPush
          ? ('PUSH' as const)
          : ('PLAYER_BLACKJACK' as const);
        const payout = isPush ? bet : Math.round(bet * 2.5 * 100) / 100;
        const xpDelta = isPush ? 10 : 24;
        const newXp = player.xp + xpDelta;
        const calculatedLevel = calculateLevelFromXp(newXp);
        const newLevel =
          calculatedLevel > player.level ? calculatedLevel : player.level;

        const updatedPlayer = await tx.player.update({
          where: { id: player.id },
          data: {
            euros: { increment: payout },
            xp: newXp,
            level: newLevel,
          },
        });
        await grantBattlePassXpTx(tx, player.id, xpDelta);

        await tx.transactionLog.create({
          data: {
            playerId: player.id,
            type: 'EARN',
            amount: payout,
            currency: 'EUR',
            reason: 'CASINO:BLACKJACK',
            reference: status,
          },
        });

        const netProfit = Math.round((payout - bet) * 100) / 100;
        const narrative = isPush
          ? 'Doble 21 natural en la mesa. Recuperas tu apuesta intacta.'
          : `¡21 de mano! El crupier solo suma ${dealerScore}. Pago 3:2 (${payout.toLocaleString('es-ES')} €).`;

        return {
          handId: null,
          status,
          bet,
          playerCards,
          dealerCards,
          playerScore,
          dealerScore,
          payout,
          netProfit,
          net: netProfit,
          xpDelta,
          xpGained: xpDelta,
          narrative,
          player: {
            euros: updatedPlayer.euros,
            xp: updatedPlayer.xp,
            level: updatedPlayer.level,
          },
        };
      }

      const handId = randomUUID();
      this.blackjackHands.set(handId, {
        handId,
        userId,
        playerId: player.id,
        bet,
        deck,
        playerCards,
        dealerCards,
        createdAt: Date.now(),
      });

      return {
        handId,
        status: 'PLAYING' as const,
        bet,
        playerCards,
        dealerCards: [dealerCards[0], { rank: '?', suit: '♠', value: 0 }],
        playerScore,
        dealerScore: dealerCards[0].value,
        payout: 0,
        netProfit: 0,
        net: 0,
        xpDelta: 0,
        xpGained: 0,
        narrative:
          'Cartas repartidas. Pide carta, plántate o dobla la apuesta.',
        player: {
          euros: Math.max(0, Math.round((player.euros - bet) * 100) / 100),
          xp: player.xp,
          level: player.level,
        },
      };
    });
  }

  async blackjackAction(userId: string, dto: BlackjackActionDto) {
    this.cleanupStaleHands();

    const hand = this.blackjackHands.get(dto.handId);
    if (!hand) {
      throw new NotFoundException('Mano de Blackjack no encontrada o expirada');
    }
    if (hand.userId !== userId) {
      throw new ForbiddenException('Esta mano de Blackjack no te pertenece');
    }
    if (hand.inFlight) {
      throw new BadRequestException(
        'Ya hay una acción en curso para esta mano',
      );
    }

    hand.inFlight = true;

    try {
      if (dto.action === 'HIT') {
        hand.playerCards.push(this.drawCard(hand.deck));
        const playerScore = this.calculateHandScore(hand.playerCards);

        if (playerScore <= 21) {
          return {
            handId: hand.handId,
            status: 'PLAYING' as const,
            bet: hand.bet,
            playerCards: hand.playerCards,
            dealerCards: [
              hand.dealerCards[0],
              { rank: '?', suit: '♠', value: 0 },
            ],
            playerScore,
            dealerScore: hand.dealerCards[0].value,
            payout: 0,
            netProfit: 0,
            net: 0,
            xpDelta: 0,
            xpGained: 0,
            narrative: `Sube tu mano a ${playerScore} puntos.`,
          };
        }

        // Player busted
        this.blackjackHands.delete(hand.handId);
        return await this.prisma.$transaction(async (tx) => {
          const player = await tx.player.findUnique({ where: { userId } });
          if (!player) {
            throw new NotFoundException('Player not found');
          }
          const xpDelta = 6;
          const newXp = player.xp + xpDelta;
          const calculatedLevel = calculateLevelFromXp(newXp);
          const newLevel =
            calculatedLevel > player.level ? calculatedLevel : player.level;

          const updatedPlayer = await tx.player.update({
            where: { id: player.id },
            data: { xp: newXp, level: newLevel },
          });
          await grantBattlePassXpTx(tx, player.id, xpDelta);

          const dealerScore = this.calculateHandScore(hand.dealerCards);
          return {
            handId: hand.handId,
            status: 'BUST' as const,
            bet: hand.bet,
            playerCards: hand.playerCards,
            dealerCards: hand.dealerCards,
            playerScore,
            dealerScore,
            payout: 0,
            netProfit: -hand.bet,
            net: -hand.bet,
            xpDelta,
            xpGained: xpDelta,
            narrative: `Has alcanzado ${playerScore} y te pasas de 21. El crupier (${dealerScore}) gana la mano.`,
            player: {
              euros: updatedPlayer.euros,
              xp: updatedPlayer.xp,
              level: updatedPlayer.level,
            },
          };
        });
      }

      if (dto.action === 'DOUBLE') {
        return await this.prisma.$transaction(async (tx) => {
          const player = await tx.player.findUnique({ where: { userId } });
          if (!player) {
            throw new NotFoundException('Player not found');
          }
          this.assertNotJailed(player.jailUntil);

          const extraBet = hand.bet;
          const debited = await tx.player.updateMany({
            where: { userId, euros: { gte: extraBet } },
            data: { euros: { decrement: extraBet } },
          });
          if (debited.count === 0) {
            throw new BadRequestException(
              `No tienes suficientes euros para doblar (${extraBet}€)`,
            );
          }

          await tx.transactionLog.create({
            data: {
              playerId: player.id,
              type: 'SPEND',
              amount: extraBet,
              currency: 'EUR',
              reason: 'CASINO:BLACKJACK',
              reference: `DOUBLE:${hand.handId}`,
            },
          });

          hand.bet = Math.round((hand.bet + extraBet) * 100) / 100;
          hand.playerCards.push(this.drawCard(hand.deck));
          const playerScore = this.calculateHandScore(hand.playerCards);

          this.blackjackHands.delete(hand.handId);

          if (playerScore > 21) {
            const xpDelta = 6;
            const newXp = player.xp + xpDelta;
            const calculatedLevel = calculateLevelFromXp(newXp);
            const newLevel =
              calculatedLevel > player.level ? calculatedLevel : player.level;

            const updatedPlayer = await tx.player.update({
              where: { id: player.id },
              data: { xp: newXp, level: newLevel },
            });
            await grantBattlePassXpTx(tx, player.id, xpDelta);

            const dealerScore = this.calculateHandScore(hand.dealerCards);
            return {
              handId: hand.handId,
              status: 'BUST' as const,
              bet: hand.bet,
              playerCards: hand.playerCards,
              dealerCards: hand.dealerCards,
              playerScore,
              dealerScore,
              payout: 0,
              netProfit: -hand.bet,
              net: -hand.bet,
              xpDelta,
              xpGained: xpDelta,
              narrative: `Doblaste la apuesta y alcanzaste ${playerScore} puntos: te pasas de 21.`,
              player: {
                euros: updatedPlayer.euros,
                xp: updatedPlayer.xp,
                level: updatedPlayer.level,
              },
            };
          }

          return this.resolveDealerTurnInTx(tx, player, hand, playerScore);
        });
      }

      // STAND
      this.blackjackHands.delete(hand.handId);
      return await this.prisma.$transaction(async (tx) => {
        const player = await tx.player.findUnique({ where: { userId } });
        if (!player) {
          throw new NotFoundException('Player not found');
        }
        const playerScore = this.calculateHandScore(hand.playerCards);
        return this.resolveDealerTurnInTx(tx, player, hand, playerScore);
      });
    } finally {
      hand.inFlight = false;
    }
  }

  private async resolveDealerTurnInTx(
    tx: Prisma.TransactionClient,
    player: { id: string; xp: number; level: number },
    hand: BlackjackHand,
    playerScore: number,
  ) {
    let dealerScore = this.calculateHandScore(hand.dealerCards);
    while (dealerScore < 17) {
      hand.dealerCards.push(this.drawCard(hand.deck));
      dealerScore = this.calculateHandScore(hand.dealerCards);
    }

    let status: 'PLAYER_WIN' | 'PUSH' | 'DEALER_WIN';
    let payout = 0;
    let xpDelta = 6;

    if (dealerScore > 21 || playerScore > dealerScore) {
      status = 'PLAYER_WIN';
      payout = Math.round(hand.bet * 2 * 100) / 100;
      xpDelta = 20;
    } else if (playerScore === dealerScore) {
      status = 'PUSH';
      payout = hand.bet;
      xpDelta = 10;
    } else {
      status = 'DEALER_WIN';
      payout = 0;
      xpDelta = 6;
    }

    const newXp = player.xp + xpDelta;
    const calculatedLevel = calculateLevelFromXp(newXp);
    const newLevel =
      calculatedLevel > player.level ? calculatedLevel : player.level;

    const updatedPlayer = await tx.player.update({
      where: { id: player.id },
      data: {
        ...(payout > 0 ? { euros: { increment: payout } } : {}),
        xp: newXp,
        level: newLevel,
      },
    });
    await grantBattlePassXpTx(tx, player.id, xpDelta);

    if (payout > 0) {
      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'EARN',
          amount: payout,
          currency: 'EUR',
          reason: 'CASINO:BLACKJACK',
          reference: `${status}:${hand.handId}`,
        },
      });
    }

    const netProfit = Math.round((payout - hand.bet) * 100) / 100;
    const narrative =
      status === 'PLAYER_WIN'
        ? dealerScore > 21
          ? `El crupier se pasa con ${dealerScore}. ¡Ganas ${payout.toLocaleString('es-ES')} €!`
          : `Superas al crupier (${playerScore} vs ${dealerScore}). ¡Cobras ${payout.toLocaleString('es-ES')} €!`
        : status === 'PUSH'
          ? `Empate a ${playerScore} puntos. Recuperas tu apuesta de ${hand.bet.toLocaleString('es-ES')} €.`
          : `El crupier alcanza ${dealerScore} frente a tu ${playerScore}. La banca se lleva la mano.`;

    return {
      handId: hand.handId,
      status,
      bet: hand.bet,
      playerCards: hand.playerCards,
      dealerCards: hand.dealerCards,
      playerScore,
      dealerScore,
      payout,
      netProfit,
      net: netProfit,
      xpDelta,
      xpGained: xpDelta,
      narrative,
      player: {
        euros: updatedPlayer.euros,
        xp: updatedPlayer.xp,
        level: updatedPlayer.level,
      },
    };
  }
}
