import type { Player } from '@/types/game';

export type VehicleClass3D =
  | 'SUPERCAR'
  | 'MOTO'
  | 'QUAD'
  | 'SUV'
  | 'TRUCK'
  | 'VAN'
  | 'BOAT'
  | 'HELI'
  | 'PLANE';

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
  vehicleClass: VehicleClass3D;
  vehicleSpeed: number;
  vehicleHandling: number;
  vehicleCondition: number;
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

const VEHICLE_COLOR_MAP: Record<string, number> = {
  white: 0xe4e4e7,
  blanco: 0xe4e4e7,
  black: 0x18181b,
  negro: 0x18181b,
  red: 0xb91c1c,
  rojo: 0xb91c1c,
  blue: 0x1d4ed8,
  azul: 0x1d4ed8,
  silver: 0x94a3b8,
  plata: 0x94a3b8,
  gold: 0xd97706,
  oro: 0xd97706,
  yellow: 0xeab308,
  amarillo: 0xeab308,
  green: 0x15803d,
  verde: 0x15803d,
  purple: 0x6d28d9,
  morado: 0x6d28d9,
};

function parseVehiclePaint(raw?: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (VEHICLE_COLOR_MAP[trimmed] !== undefined) {
    return VEHICLE_COLOR_MAP[trimmed];
  }
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return Number.parseInt(trimmed.slice(1), 16);
  }
  return null;
}

export function inferVehicleClass3D(
  name?: string,
  brand?: string,
): VehicleClass3D {
  const key = `${brand ?? ''} ${name ?? ''}`.toUpperCase();
  if (
    key.includes('EC145') ||
    key.includes('H125') ||
    key.includes('AW139') ||
    key.includes('HELO') ||
    key.includes('AIRBUS') ||
    key.includes('EUROCOPTER')
  ) {
    return 'HELI';
  }
  if (
    key.includes('CESSNA') ||
    key.includes('CITATION') ||
    key.includes('JET')
  ) {
    return 'PLANE';
  }
  if (
    key.includes('PERSHING') ||
    key.includes('RIVA') ||
    key.includes('AQUARAMA') ||
    key.includes('PLANEADORA') ||
    key.includes('ASTILLEROS')
  ) {
    return 'BOAT';
  }
  if (
    key.includes('VESPA') ||
    key.includes('PIAGGIO') ||
    key.includes('MT-07') ||
    key.includes('PANIGALE') ||
    key.includes('DUCATI') ||
    key.includes('NINJA') ||
    key.includes('S 1000 RR') ||
    key.includes('KAWASAKI')
  ) {
    return 'MOTO';
  }
  if (
    key.includes('RAPTOR') ||
    key.includes('OUTLANDER') ||
    key.includes('CAN-AM')
  ) {
    return 'QUAD';
  }
  if (key.includes('ACTROS') || key.includes('FH16') || key.includes('VOLVO')) {
    return 'TRUCK';
  }
  if (
    key.includes('SPRINTER') ||
    key.includes('CRAFTER') ||
    key.includes('SAMUR') ||
    key.includes('UVI')
  ) {
    return 'VAN';
  }
  if (
    key.includes('DEFENDER') ||
    key.includes('G 63') ||
    key.includes('G63') ||
    key.includes('BRABUS') ||
    key.includes('CULLINAN') ||
    key.includes('HILUX') ||
    key.includes('HUMMER')
  ) {
    return 'SUV';
  }
  return 'SUPERCAR';
}

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
  const activeVehicle =
    ownedVehicles.find((v) => v.isPrimary) ??
    ownedVehicles.find((v) => v.template?.isVipOnly) ??
    ownedVehicles[0];
  const vehicleName = activeVehicle?.template?.name;
  const vehicleClass = inferVehicleClass3D(
    activeVehicle?.template?.name,
    activeVehicle?.template?.brand,
  );
  const vehicleSpeed = activeVehicle?.template?.speed ?? 75;
  const vehicleHandling = activeVehicle?.template?.handling ?? 75;
  const vehicleCondition = activeVehicle?.condition ?? 100;
  const hasVipVehicle = Boolean(activeVehicle?.template?.isVipOnly);

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

  let carBodyColor = parseVehiclePaint(activeVehicle?.color) ?? 0x18181b;
  if (hasVipVehicle && !activeVehicle?.color) {
    carBodyColor = 0x312e81; // Royal metallic indigo for VIP fleet
  } else if (hasVipVehicle && activeVehicle?.color === 'white') {
    carBodyColor = 0x312e81;
  }
  if ((hasGoldPlate || isVip) && !activeVehicle?.color) {
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
    activeVehicle?.id ?? '',
    activeVehicle?.color ?? '',
    vehicleName ?? '',
    vehicleClass,
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
    vehicleClass,
    vehicleSpeed,
    vehicleHandling,
    vehicleCondition,
    avatarBodyColor,
    avatarAccentColor,
    carBodyColor,
    carAccentColor,
    carUnderglowColor,
    carUnderglowOpacity,
  };
}
