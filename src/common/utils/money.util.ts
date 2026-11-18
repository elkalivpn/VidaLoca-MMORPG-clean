export type NumericLike =
  number | string | { toNumber: () => number } | null | undefined;

export function roundEuros(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

export function roundVidaCoins(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

export function isDecimalLike(
  value: unknown,
): value is { toNumber: () => number } {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as {
    toNumber?: unknown;
    constructor?: { name?: string };
  };
  if (typeof candidate.toNumber !== 'function') return false;
  return (
    candidate.constructor?.name === 'Decimal' ||
    ('d' in value && 'e' in value && 's' in value)
  );
}

export function toEuros(value: NumericLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return roundEuros(value);
  if (typeof value === 'string') return roundEuros(Number(value));
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return roundEuros(value.toNumber());
  }
  return 0;
}

export function normalizeDecimals<T>(value: T, depth = 0): T {
  if (value === null || value === undefined || depth > 12) return value;
  if (isDecimalLike(value)) {
    return roundEuros(value.toNumber()) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) =>
      normalizeDecimals(item, depth + 1),
    ) as unknown as T;
  }
  if (typeof value === 'object') {
    if (value instanceof Date || Buffer.isBuffer(value)) {
      return value;
    }
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = normalizeDecimals(val, depth + 1);
    }
    return result as T;
  }
  return value;
}
