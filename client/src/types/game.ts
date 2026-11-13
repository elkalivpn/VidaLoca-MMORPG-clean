export interface User {
  id: string;
  email: string;
  username: string;
  role: 'PLAYER' | 'ADMIN' | 'MODERATOR';
}

export type FactionType =
  'CIVILIAN' | 'POLICE' | 'GUARDIA_CIVIL' | 'SYNDICATE' | 'ENTREPRENEUR';

export interface Player {
  id: string;
  userId: string;
  displayName: string;
  level: number;
  xp: number;
  reputation: number;
  euros: number;
  vidaCoins: number;
  locationId: string | null;
  heat?: number;
  lifestyle?: string;
  faction?: FactionType;
  factionRank?: number;
  wantedLevel?: number;
  jailUntil?: string | null;
  isOnline: boolean;
  lastLogin: string;
  inventory?: InventoryItem[];
  vehicles?: PlayerVehicle[];
  properties?: PlayerProperty[];
  weapons?: PlayerWeapon[];
  skills?: PlayerSkill[];
  clanMember?: { clan: Clan } | null;
  battlePass?: BattlePassProgress | null;
}

export interface InventoryItem {
  id: string;
  quantity: number;
  equipped: boolean;
  template: ItemTemplate;
}

export interface ItemTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  priceEuros?: number;
  priceVida?: number;
}

export interface PlayerVehicle {
  id: string;
  licensePlate: string;
  color: string;
  condition: number;
  isPrimary: boolean;
  template: VehicleTemplate;
}

export interface VehicleTemplate {
  id: string;
  name: string;
  brand: string;
  speed: number;
  handling: number;
  durability: number;
  capacity: number;
  priceEuros?: number;
  priceVida?: number;
}

export interface PlayerProperty {
  id: string;
  purchasedAt: string;
  customized?: Record<string, unknown>;
  template: PropertyTemplate;
}

export interface PropertyTemplate {
  id: string;
  name: string;
  location: string;
  type: string;
  capacity: number;
  security: number;
  priceEuros: number;
  priceVida?: number;
  rentYield?: number;
}

export interface PlayerWeapon {
  id: string;
  name: string;
  damage: number;
  range: number;
  accuracy: number;
  equipped: boolean;
}

export interface PlayerSkill {
  id: string;
  level: number;
  xp: number;
  skill: Skill;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  category: string;
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  level: number;
  funds: number;
}

export interface MissionTemplate {
  id: string;
  title: string;
  description: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'SUICIDE';
  rewardEuros: number;
  rewardXp: number;
}

export interface PlayerMission {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CLAIMED';
  progress: number;
  startedAt: string;
  completedAt?: string;
  template: MissionTemplate;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  rewardVida: number;
  rewardEuros: number;
}

export interface PlayerAchievement {
  id: string;
  unlockedAt: string;
  achievement: Achievement;
}

export interface BattlePassSeason {
  id: string;
  seasonNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface BattlePassProgress {
  id: string;
  level: number;
  xp: number;
  isPremium: boolean;
  rewardsClaimed: number[];
  season?: BattlePassSeason;
}

export interface CityLocation {
  id: string;
  name: string;
  city: string;
  lng: number;
  lat: number;
  x?: number; // % fallback on schematic map
  y?: number;
  description: string;
  vibe: 'luxury' | 'street' | 'business' | 'nightlife' | 'industrial';
}

export interface WorldMapZone {
  id: string;
  name?: string;
  city?: string;
  lng?: number;
  lat?: number;
  vibe?: CityLocation['vibe'];
  description?: string;
  controlledByClan?: { id?: string; name: string; tag: string } | null;
  clanTag?: string | null;
  clanName?: string | null;
  playerCount?: number;
}

export interface WorldMapRoute {
  from: string;
  to: string;
  highway: string;
  distanceKm?: number;
}

export interface WorldMapResponse {
  currentLocationId?: string;
  zones?: WorldMapZone[];
  routes?: WorldMapRoute[];
  territories?: Array<{
    locationId?: string;
    zoneId?: string;
    clan?: { id?: string; name: string; tag: string } | null;
  }>;
}

export interface WorldTravelResponse {
  ok?: boolean;
  fromId?: string;
  destinationId: string;
  highway?: string;
  distanceKm?: number;
  costEuros?: number;
  durationMinutes?: number;
  vehicleUsed?: string | null;
  narrative?: string;
  guardiaCivil?: {
    encountered: boolean;
    fined?: boolean;
    fineEuros?: number;
    heatDelta?: number;
    message?: string;
  } | null;
  checkpoint?: {
    triggered?: boolean;
    outcome?: string;
    fineEuros?: number;
    message?: string;
  } | null;
  player?: Partial<Player>;
}

export interface FactionInfo {
  id: FactionType;
  name: string;
  shortName?: string;
  description: string;
  perks: string[];
  badge?: string;
  memberCount?: number;
}

export interface WantedSuspect {
  playerId: string;
  id?: string;
  displayName: string;
  heat: number;
  wantedLevel: number;
  locationId: string | null;
  faction?: FactionType;
  bountyEuros: number;
  bounty?: number;
  level?: number;
}

export interface InterceptResponse {
  ok?: boolean;
  success?: boolean;
  intercepted?: boolean;
  message?: string;
  rewardEuros?: number;
  bountyEuros?: number;
  xpGained?: number;
  jailUntil?: string | null;
  targetPlayerId?: string;
  targetDisplayName?: string;
  player?: Partial<Player>;
}

export interface BailResponse {
  ok?: boolean;
  paidEuros?: number;
  message?: string;
  jailUntil?: string | null;
  player?: Partial<Player>;
}
