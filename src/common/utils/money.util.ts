export function roundEuros(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

export function roundVidaCoins(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}
