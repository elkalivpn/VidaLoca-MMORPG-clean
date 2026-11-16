export function isPlayerVipActive(player: {
  isVip?: boolean | null;
  vipExpiresAt?: Date | string | null;
}): boolean {
  if (!player?.isVip) return false;
  if (!player.vipExpiresAt) return true;
  return new Date(player.vipExpiresAt).getTime() > Date.now();
}
