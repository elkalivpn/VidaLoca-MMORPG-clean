import { Prisma } from '@prisma/client';
import {
  isDecimalLike,
  normalizeDecimals,
  roundEuros,
  roundVidaCoins,
  toEuros,
} from './money.util';

describe('money.util', () => {
  describe('roundEuros', () => {
    it('rounds IEEE-754 floating point inaccuracies to 2 decimal places', () => {
      expect(roundEuros(0.1 + 0.2)).toBe(0.3);
      expect(roundEuros(19.995)).toBe(20);
      expect(roundEuros(-0.0001)).toBe(0);
      expect(roundEuros(Number.NaN)).toBe(0);
      expect(roundEuros(Number.POSITIVE_INFINITY)).toBe(0);
    });
  });

  describe('roundVidaCoins', () => {
    it('clamps non-finite and negative values to non-negative integers', () => {
      expect(roundVidaCoins(12.6)).toBe(13);
      expect(roundVidaCoins(-5)).toBe(0);
      expect(roundVidaCoins(Number.NaN)).toBe(0);
    });
  });

  describe('isDecimalLike', () => {
    it('detects real Prisma.Decimal instances and Decimal-like objects', () => {
      expect(isDecimalLike(new Prisma.Decimal('1234.56'))).toBe(true);
      expect(isDecimalLike({ d: [100], e: 2, s: 1, toNumber: () => 100 })).toBe(
        true,
      );
      expect(isDecimalLike({ toNumber: () => 100 })).toBe(false);
      expect(isDecimalLike(100)).toBe(false);
      expect(isDecimalLike(null)).toBe(false);
    });
  });

  describe('toEuros', () => {
    it('converts numbers, strings, Prisma.Decimal, and nullish values accurately', () => {
      expect(toEuros(150.125)).toBe(150.13);
      expect(toEuros('249.995')).toBe(250);
      expect(toEuros(new Prisma.Decimal('1999.95'))).toBe(1999.95);
      expect(toEuros({ toNumber: () => 0.1 + 0.2 })).toBe(0.3);
      expect(toEuros(null)).toBe(0);
      expect(toEuros(undefined)).toBe(0);
    });
  });

  describe('normalizeDecimals', () => {
    it('converts nested Prisma.Decimal fields into JSON-safe numbers while preserving Date and Buffer', () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const rawBuffer = Buffer.from('vidaloca');

      const input = {
        id: 'player-1',
        euros: new Prisma.Decimal('1250.50'),
        dirtyEuros: new Prisma.Decimal('0.00'),
        createdAt,
        rawBuffer,
        nested: {
          clanFunds: new Prisma.Decimal('99999.99'),
          items: [
            { id: 'i1', priceEuros: new Prisma.Decimal('49.95') },
            { id: 'i2', priceEuros: null },
          ],
        },
      };

      const normalized = normalizeDecimals(input);

      expect(normalized.id).toBe('player-1');
      expect(normalized.euros).toBe(1250.5);
      expect(normalized.dirtyEuros).toBe(0);
      expect(normalized.createdAt).toBe(createdAt);
      expect(normalized.rawBuffer).toBe(rawBuffer);
      expect(normalized.nested.clanFunds).toBe(99999.99);
      expect(normalized.nested.items[0].priceEuros).toBe(49.95);
      expect(normalized.nested.items[1].priceEuros).toBeNull();
    });
  });
});
