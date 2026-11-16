import type { Player } from '@/types/game';

export interface PlayerAppearance3D {
  appearanceKey: string;
  isVip: boolean;
  hasVipCrown: boolean;
  hasBlueNeon: boolean;
  hasGoldPlate: boolean;
  characterName?: string;
  clothingName?: string;
  cosmeticName?: string;
  vehicleName?: string;
  avatarBodyColor: number;
  avatarAccentColor: number;
  carBodyColor: number;
  carAccentColor: number;
  carUnderglowColor: number;
  carUnderglowOpacity: number;
}

const CHARACTER_COLORS: Record<string, { body: number; accent: number }> = {
  'La Jefa de Ibiza': { body: 0x86198f, accent: 0xf472b6 },
  'Agente Sombra CNI': { body: 0x09090b, accent: 0x38bdf8 },
  'Piloto Nocturno Apex': { body: 0x991b1b, accent: 0xf97316 },
  'Magnate de Puerto Banús': { body: 0x78350f, accent: 0xfbbf24 },
};

const CLOTHING_COLORS: Record<string, { body: number; accent?: number }> = {
  'Esmoquin Blanco Puerto Banús': { body: 0xf8fafc, accent: 0xfbbf24 },
  'Chaqueta Cuero Apex Drift': { body: 0xb91c1c, accent: 0xfef08a },
  'Gabardina Táctica Kevlar': { body: 0x1e293b, accent: 0x38bdf8 },
  'Gafas Aviador Oro 24K': { body: 0x27272a, accent: 0xfbbf24 },
};

export function resolvePlayerAppearance3D(
  player?: Player | null,
  fallbackAccent = 0xf59e0b,
): PlayerAppearance3D {
  const isVip = Boolean(
    player?.isVip &&
    (!player.vipExpiresAt || new Date(player.vipExpiresAt) > new Date()),
  );

  const inventory = Array.isArray(player?.inventory) ? player.inventory : [];
  const equippedChar = inventory.find(
    (i) => i.equipped && i.template?.type === 'CHARACTER',
  )?.template?.name;
  const equippedCloth = inventory.find(
    (i) => i.equipped && i.template?.type === 'CLOTHING',
  )?.template?.name;
  const equippedCosmetic = inventory.find(
    (i) => i.equipped && i.template?.type === 'COSMETIC',
  )?.template?.name;

  const ownedVehicles = Array.isArray(player?.vehicles) ? player.vehicles : [];
  const vipVehicle = ownedVehicles.find((v) => v.template?.isVipOnly);
  const activeVehicle = vipVehicle ?? ownedVehicles[0];
  const vehicleName = activeVehicle?.template?.name;
  const hasVipVehicle = Boolean(vipVehicle);

  const hasBlueNeon = equippedCosmetic === 'Kit Neón Azul Nocturno';
  const hasGoldPlate = equippedCosmetic === 'Matrícula Dorada VIP';
  const hasFounderEmblem = equippedCosmetic === 'Emblema Fundador VidaLoca';
  const hasVipCrown = isVip || hasFounderEmblem;

  let avatarBodyColor = 0x27272a;
  let avatarAccentColor = isVip ? 0xfbbf24 : fallbackAccent;

  if (equippedChar && CHARACTER_COLORS[equippedChar]) {
    avatarBodyColor = CHARACTER_COLORS[equippedChar].body;
    avatarAccentColor = CHARACTER_COLORS[equippedChar].accent;
  }
  if (equippedCloth && CLOTHING_COLORS[equippedCloth]) {
    avatarBodyColor = CLOTHING_COLORS[equippedCloth].body;
    if (CLOTHING_COLORS[equippedCloth].accent !== undefined) {
      avatarAccentColor = CLOTHING_COLORS[equippedCloth].accent;
    }
  }
  if (hasFounderEmblem) {
    avatarAccentColor = 0xfbbf24;
  }

  let carBodyColor = 0x18181b;
  if (hasVipVehicle) {
    carBodyColor = 0x312e81; // Royal metallic indigo for VIP fleet
  }
  if (hasGoldPlate || isVip) {
    carBodyColor = hasVipVehicle ? 0x1e1b4b : 0x27272a;
  }

  let carAccentColor = isVip ? 0xfbbf24 : fallbackAccent;
  let carUnderglowColor = carAccentColor;
  let carUnderglowOpacity = isVip ? 0.36 : 0.22;

  if (hasBlueNeon) {
    carAccentColor = 0x00d4ff;
    carUnderglowColor = 0x00d4ff;
    carUnderglowOpacity = 0.6;
  } else if (hasGoldPlate || hasFounderEmblem) {
    carAccentColor = 0xfbbf24;
    carUnderglowColor = 0xfbbf24;
    carUnderglowOpacity = 0.48;
  }

  const appearanceKey = [
    isVip ? 'vip' : 'std',
    equippedChar ?? '',
    equippedCloth ?? '',
    equippedCosmetic ?? '',
    vehicleName ?? '',
  ].join('|');

  return {
    appearanceKey,
    isVip,
    hasVipCrown,
    hasBlueNeon,
    hasGoldPlate,
    characterName: equippedChar,
    clothingName: equippedCloth,
    cosmeticName: equippedCosmetic,
    vehicleName,
    avatarBodyColor,
    avatarAccentColor,
    carBodyColor,
    carAccentColor,
    carUnderglowColor,
    carUnderglowOpacity,
  };
}
