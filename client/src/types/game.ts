export interface User {
  id: string;
  email: string;
  username: string;
  role: 'PLAYER' | 'ADMIN' | 'MODERATOR';
  isGuest?: boolean;
}

export type FactionType =
  | 'CIVILIAN'
  | 'POLICE'
  | 'GUARDIA_CIVIL'
  | 'SYNDICATE'
  | 'ENTREPRENEUR'
  | 'ERTZAINTZA_MOSSOS'
  | 'CYBER_HACKER'
  | 'CARTEL_MARITIMO'
  | 'NIGHT_RACING';

export interface Player {
  id: string;
  userId: string;
  displayName: string;
  level: number;
  xp: number;
  reputation: number;
  euros: number;
  dirtyEuros?: number;
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
  referralCode?: string | null;
  loginStreak?: number;
  isVip?: boolean;
  vipExpiresAt?: string | null;
  user?: {
    username: string;
    isGuest?: boolean;
  };
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
  stats?: Record<string, unknown>;
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
  isVipOnly?: boolean;
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
  isVipOnly?: boolean;
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
  leaderId?: string;
  level: number;
  funds: number;
}

export type MissionMode = 'STORY' | 'ONLINE_SOLO' | 'ONLINE_COOP';

export interface MissionTemplate {
  id: string;
  title: string;
  description: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'SUICIDE';
  mode?: MissionMode;
  category?: string;
  city?: string | null;
  minLevel?: number;
  minPlayers?: number;
  maxPlayers?: number;
  isOptional?: boolean;
  isRepeatable?: boolean;
  cooldownHours?: number;
  requiredSteps?: number;
  isVipOnly?: boolean;
  rewardEuros: number;
  rewardXp: number;
  rewardVidaCoins?: number;
  rewardReputation?: number;
  rewardItemName?: string | null;
  unlockBenefit?: string | null;
  requirement?: Record<string, unknown> | null;
}

export interface CoopParticipant {
  playerId: string;
  userId: string;
  displayName: string;
  role: 'LEADER' | 'MEMBER';
  joinedAt: string;
}

export interface PlayerMission {
  id: string;
  playerId?: string;
  status:
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'FAILED'
    | 'CLAIMED'
    | 'ABANDONED'
    | 'SKIPPED';
  progress: number;
  squadCode?: string | null;
  coOpParticipants?: CoopParticipant[] | null;
  lastStepAt?: string | null;
  startedAt: string;
  completedAt?: string;
  player?: { id: string; displayName: string; level?: number };
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
  hasClubVip?: boolean;
  effectivePremium?: boolean;
  premiumPriceVida?: number;
  xpPerLevel?: number;
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
    id?: string;
    name?: string;
    city?: string;
    locationId?: string;
    zoneId?: string;
    controller?: { id?: string; name: string; tag: string } | null;
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
  activeMembers?: number;
  memberCount?: number;
}

export interface WantedSuspect {
  playerId?: string;
  id: string;
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
  captured: boolean;
  outcome: 'CAPTURED' | 'ESCAPED';
  locationId?: string;
  captureChance?: number;
  fineEuros?: number;
  bountyEuros?: number;
  suspectRepGain?: number;
  agentXpGain?: number;
  jailUntil?: string | null;
  message?: string;
  agent?: {
    id: string;
    displayName: string;
    euros: number;
    xp: number;
    level: number;
  };
  suspect?: {
    id: string;
    displayName: string;
    heat: number;
    wantedLevel: number;
    jailUntil?: string | null;
  };
}

export interface BailResponse {
  released?: boolean;
  bailCost?: number;
  eurosRemaining?: number;
  paidEuros?: number;
  message?: string;
  jailUntil?: string | null;
}

export interface PropertyUseResponse {
  ok?: boolean;
  message?: string;
  effect?: string;
  heat?: number;
  heatReduced?: number;
  repairedCount?: number;
  launderedEuros?: number;
  dirtyLaundered?: number;
  cleanEuros?: number;
  bonusEuros?: number;
  earnedEuros?: number;
  player?: Partial<Player>;
}

export interface MarketItem {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  currentPrice: number;
  owned: number;
  cityPrices?: Record<string, number>;
  buyPrice?: number;
  sellPrice?: number;
  price?: number;
}

export interface WorldMarketResponse {
  currentZoneId?: string;
  currentCity?: string;
  hourWindow?: number;
  windowExpiresAt?: string;
  euros?: number;
  goods: MarketItem[];
  locationId?: string;
  city?: string;
  items?: MarketItem[];
}

export interface MarketTradeResponse {
  action: 'BUY' | 'SELL';
  goodId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  maritimeBonusApplied?: boolean;
  city: string;
  owned: number;
  euros: number;
  message?: string;
}

export type HeistRole = 'DRIVER' | 'HACKER' | 'ENFORCER';

export interface HeistTemplate {
  id: string;
  name: string;
  city?: string;
  zoneId?: string;
  description?: string;
  difficulty?: 'MEDIUM' | 'HARD' | 'SUICIDE';
  minLevel?: number;
  minCrew?: number;
  maxCrew?: number;
  rewardEuros?: number;
  rewardDirtyEuros?: number;
  rewardXp?: number;
  baseHeat?: number;
  baseSuccessChance?: number;
}

export interface HeistLobbyMember {
  playerId: string;
  userId?: string;
  displayName?: string;
  role: HeistRole;
  joinedAt?: string;
}

export interface HeistLobby {
  id: string;
  heistId: string;
  heistName?: string;
  zoneId: string;
  leaderPlayerId: string;
  status: string;
  participants: HeistLobbyMember[];
  createdAt?: string;
}

export interface HeistsOverviewResponse {
  catalog: HeistTemplate[];
  activeLobbies: HeistLobby[];
}

export interface HeistRewardEntry {
  playerId: string;
  displayName: string;
  role: HeistRole;
  eurosGained: number;
  dirtyEurosGained: number;
  xpGained: number;
  battlePassXpGained?: number;
  heatGained: number;
  reputationGained?: number;
  newLevel: number;
  newHeat: number;
  newWantedLevel: number;
}

export interface HeistExecuteResponse {
  outcome: 'COMPLETED' | 'FAILED';
  succeeded: boolean;
  heist: { id: string; name: string; difficulty: string };
  lobbyId: string;
  rewards: HeistRewardEntry[];
  narrative: string;
}

export interface DailyStreakReward {
  day: number;
  euros: number;
  vidaCoins: number;
  xp: number;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  metric: 'action' | 'travel' | 'trade' | 'mission';
  target: number;
  progress: number;
  claimed: boolean;
  rewardEuros: number;
  rewardXp: number;
  rewardVidaCoins: number;
}

export interface EngagementStatus {
  isGuest: boolean;
  loginStreak: number;
  canClaimDaily: boolean;
  nextClaimAt: string | null;
  nextDay: number;
  nextReward: DailyStreakReward;
  streakTable: DailyStreakReward[];
  referralCode: string | null;
  referralsCount: number;
  isVip: boolean;
  vipExpiresAt: string | null;
  dailyChallenges: DailyChallenge[];
}

export interface LeaderboardPlayer {
  id: string;
  displayName: string;
  level: number;
  euros: number;
  reputation: number;
  heat: number;
  faction: FactionType;
  isVip: boolean;
  locationId: string | null;
  clanTag: string | null;
}

export interface LeaderboardClan {
  id: string;
  name: string;
  tag: string;
  level: number;
  funds: number;
  membersCount: number;
  territoriesCount: number;
}

export interface LeaderboardsResponse {
  richest: LeaderboardPlayer[];
  topLevel: LeaderboardPlayer[];
  mostWanted: LeaderboardPlayer[];
  topClans: LeaderboardClan[];
  cachedAt: string;
}

export interface MarketListing {
  id: string;
  sellerId: string;
  templateId: string;
  quantity: number;
  priceEuros: number;
  status: 'ACTIVE' | 'SOLD' | 'CANCELLED';
  createdAt: string;
  template: ItemTemplate;
  seller: {
    id: string;
    displayName: string;
    level: number;
    isVip: boolean;
  };
}

export interface VipShopOffer {
  id: string;
  name: string;
  description: string;
  priceVida: number;
  category:
    'VIP' | 'UTILITY' | 'CHARACTER' | 'CLOTHING' | 'WEAPON' | 'COSMETIC';
  templateName?: string;
}

export interface WorldEventItem {
  id: string;
  title: string;
  city: string;
  zoneId: string;
  description: string;
  rewardEuros: number;
  rewardXp: number;
  rewardVidaCoins: number;
}

export interface PlayerActivityItem {
  id: string;
  type: 'EARN' | 'SPEND' | 'PURCHASE' | 'GIFT' | 'PENALTY';
  amount: number;
  currency: 'EUR' | 'VIDACOIN';
  reason: string;
  createdAt: string;
}

export interface WorldEventStatus {
  hourKey: string;
  event: WorldEventItem;
  endsAt: string;
  remainingSeconds: number;
  participated: boolean;
  isVip: boolean;
  recentActivity: PlayerActivityItem[];
}

export interface AdminOverviewResponse {
  metrics: {
    totalUsers: number;
    guestUsers: number;
    totalPlayers: number;
    activeVipPlayers: number;
    activeListings: number;
    totalClans: number;
    totalEurosInEconomy: number;
    totalVidaCoinsInEconomy: number;
  };
  recentPlayers: Array<{
    id: string;
    userId: string;
    displayName: string;
    level: number;
    euros: number;
    vidaCoins: number;
    isVip: boolean;
    vipExpiresAt: string | null;
    user: {
      username: string;
      email: string;
      role: string;
      isGuest: boolean;
      isBanned: boolean;
      banReason: string | null;
    };
  }>;
  recentAuditLogs: Array<{
    id: string;
    actorId: string | null;
    eventType: string;
    severity: string;
    target: string | null;
    createdAt: string;
  }>;
}
