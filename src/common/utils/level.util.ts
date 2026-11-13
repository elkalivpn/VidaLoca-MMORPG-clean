export function calculateLevelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / 1000) + 1;
}
