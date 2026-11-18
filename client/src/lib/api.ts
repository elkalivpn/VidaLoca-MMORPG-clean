import type {
  BailResponse,
  EngagementStatus,
  FactionInfo,
  FactionType,
  HeistExecuteResponse,
  HeistLobby,
  HeistRole,
  HeistsOverviewResponse,
  InterceptResponse,
  LeaderboardsResponse,
  MarketItem,
  MarketListing,
  MarketTradeResponse,
  Player,
  PropertyUseResponse,
  VipShopOffer,
  WantedSuspect,
  WorldMapResponse,
  WorldMarketResponse,
  WorldTravelResponse,
  WorldEventStatus,
  AdminOverviewResponse,
  CasinoStatusResponse,
  CasinoRouletteBetType,
  CasinoRouletteResponse,
  CasinoDiceChoice,
  CasinoDiceResponse,
  CasinoBlackjackResponse,
  StreetCombatResponse,
} from '@/types/game';

const RAW_API_BASE = (process.env.NEXT_PUBLIC_API_URL || '')
  .trim()
  .replace(/\/+$/, '');
const API_BASE = RAW_API_BASE.endsWith('/api')
  ? RAW_API_BASE.slice(0, -4)
  : RAW_API_BASE;

type ApiSuccess<T> = { success: true; data: T; timestamp: string };
type ApiError = {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const raw: unknown = await res.json().catch(() => ({}));
  const body = (raw && typeof raw === 'object' ? raw : {}) as
    ApiSuccess<T> | ApiError | Record<string, unknown>;

  if (!res.ok || ('success' in body && body.success === false)) {
    const err = body as ApiError;
    const msg = Array.isArray(err.message)
      ? err.message.join(', ')
      : err.message || `Error ${res.status}`;
    throw new Error(msg);
  }

  if ('data' in body && 'success' in body && body.success === true) {
    return (body as ApiSuccess<T>).data;
  }
  return body as T;
}

export const api = {
  register: (data: {
    email: string;
    username: string;
    password: string;
    displayName: string;
    referralCode?: string;
  }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  guestLogin: (data?: { displayName?: string; referralCode?: string }) =>
    request('/auth/guest', {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  convertGuest: (data: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }) =>
    request('/auth/convert-guest', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  me: () => request('/players/me'),
  updateLocation: (locationId: string) =>
    request('/players/location', {
      method: 'POST',
      body: JSON.stringify({ locationId }),
    }),

  missionTemplates: (
    difficultyOrFilters?:
      string | { difficulty?: string; mode?: string; city?: string },
  ) => {
    const params = new URLSearchParams();
    if (typeof difficultyOrFilters === 'string' && difficultyOrFilters) {
      params.set('difficulty', difficultyOrFilters);
    } else if (difficultyOrFilters && typeof difficultyOrFilters === 'object') {
      if (difficultyOrFilters.difficulty)
        params.set('difficulty', difficultyOrFilters.difficulty);
      if (difficultyOrFilters.mode)
        params.set('mode', difficultyOrFilters.mode);
      if (difficultyOrFilters.city)
        params.set('city', difficultyOrFilters.city);
    }
    const qs = params.toString();
    return request(`/missions/templates${qs ? `?${qs}` : ''}`);
  },
  myMissions: () => request('/missions/my'),
  startMission: (templateId: string) =>
    request('/missions/start', {
      method: 'POST',
      body: JSON.stringify({ templateId }),
    }),
  advanceMission: (missionId: string) =>
    request(`/missions/${missionId}/advance`, { method: 'POST' }),
  abandonMission: (missionId: string) =>
    request(`/missions/${missionId}/abandon`, { method: 'POST' }),
  skipMission: (templateId: string) =>
    request('/missions/skip', {
      method: 'POST',
      body: JSON.stringify({ templateId }),
    }),
  openCoopSquads: () => request('/missions/coop/open'),
  createCoopSquad: (templateId: string) =>
    request('/missions/coop/create', {
      method: 'POST',
      body: JSON.stringify({ templateId }),
    }),
  joinCoopSquad: (squadCode: string) =>
    request('/missions/coop/join', {
      method: 'POST',
      body: JSON.stringify({ squadCode }),
    }),
  leaveCoopMission: (missionId: string) =>
    request<{
      left: boolean;
      disbanded: boolean;
      missionId: string;
      message?: string;
    }>(`/missions/coop/${missionId}/leave`, { method: 'POST' }),
  updateMissionProgress: (missionId: string, progress: number) =>
    request(`/missions/${missionId}/progress`, {
      method: 'POST',
      body: JSON.stringify({ progress }),
    }),
  claimMission: (missionId: string) =>
    request('/missions/claim', {
      method: 'POST',
      body: JSON.stringify({ missionId }),
    }),

  vehicleCatalog: () => request('/vehicles/catalog'),
  myVehicles: () => request('/vehicles/my'),
  buyVehicle: (
    templateId: string,
    color?: string,
    currency?: 'EUR' | 'VIDACOIN',
  ) =>
    request('/vehicles/buy', {
      method: 'POST',
      body: JSON.stringify({ templateId, color, currency }),
    }),
  setPrimaryVehicle: (id: string) =>
    request(`/vehicles/${id}/primary`, { method: 'POST' }),
  repairVehicle: (vehicleId: string) =>
    request('/vehicles/repair', {
      method: 'POST',
      body: JSON.stringify({ vehicleId }),
    }),

  propertyCatalog: () => request('/properties/catalog'),
  myProperties: () => request('/properties/my'),
  buyProperty: (templateId: string) =>
    request('/properties/buy', {
      method: 'POST',
      body: JSON.stringify({ templateId }),
    }),
  collectRent: (id: string) =>
    request(`/properties/${id}/rent`, { method: 'POST' }),
  useProperty: (propertyId: string) =>
    request<PropertyUseResponse>(`/properties/${propertyId}/use`, {
      method: 'POST',
    }),

  skills: (category?: string) =>
    request(`/skills${category ? `?category=${category}` : ''}`),
  mySkills: () => request('/skills/my'),
  trainSkill: (skillId: string, xpAmount = 50) =>
    request('/skills/train', {
      method: 'POST',
      body: JSON.stringify({ skillId, xpAmount }),
    }),

  achievements: () => request('/achievements'),
  myAchievements: () => request('/achievements/my'),
  checkAchievements: () => request('/achievements/check', { method: 'POST' }),

  battlePassSeason: () => request('/battle-pass/season'),
  myBattlePass: () => request('/battle-pass/my'),
  battlePassXp: (amount: number) =>
    request('/battle-pass/xp', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  claimBattlePass: (level: number) =>
    request('/battle-pass/claim', {
      method: 'POST',
      body: JSON.stringify({ level }),
    }),
  unlockBattlePassPremium: () =>
    request('/battle-pass/unlock-premium', {
      method: 'POST',
    }),

  // Clans
  myClan: () => request('/clans/my'),
  createClan: (name: string, tag: string) =>
    request('/clans/create', {
      method: 'POST',
      body: JSON.stringify({ name, tag }),
    }),
  joinClan: (clanId: string) =>
    request(`/clans/join/${clanId}`, { method: 'POST' }),
  leaveClan: () => request('/clans/leave', { method: 'POST' }),
  transferClanLeadership: (targetPlayerId: string) =>
    request<{
      transferred: boolean;
      newLeaderPlayerId: string;
      newLeaderName: string;
    }>('/clans/transfer', {
      method: 'POST',
      body: JSON.stringify({ targetPlayerId }),
    }),
  kickClanMember: (targetPlayerId: string) =>
    request<{
      kicked: boolean;
      targetPlayerId: string;
      targetName: string;
    }>(`/clans/kick/${targetPlayerId}`, { method: 'POST' }),
  disbandClan: () =>
    request<{ disbanded: boolean; clanId: string }>('/clans/disband', {
      method: 'POST',
    }),
  donateToClan: (amount: number) =>
    request<{ donated: number; clanFunds: number }>('/clans/donate', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  clanLeaderboard: () => request('/clans/leaderboard'),
  territories: () => request('/clans/territories'),
  claimTerritory: (territoryId: string) =>
    request(`/clans/territories/${territoryId}/claim`, { method: 'POST' }),
  collectClanTerritoryTax: (territoryId: string) =>
    request<{ territoryName: string; taxAmount: number; clanFunds: number }>(
      `/clans/territories/${territoryId}/collect`,
      { method: 'POST' },
    ),

  // Inventory & Urban Shop
  inventoryShop: () => request('/inventory/shop'),
  buyInventoryItem: (
    templateId: string,
    quantity = 1,
    currency?: 'EUR' | 'VIDACOIN',
  ) =>
    request<{
      quantity: number;
      totalCost: number;
      currency: string;
      message?: string;
    }>('/inventory/buy', {
      method: 'POST',
      body: JSON.stringify({ templateId, quantity, currency }),
    }),
  inventory: () => request('/inventory'),
  equipItem: (itemId: string) =>
    request(`/inventory/equip/${itemId}`, { method: 'POST' }),
  unequipItem: (itemId: string) =>
    request(`/inventory/unequip/${itemId}`, { method: 'POST' }),
  useItem: (itemId: string) =>
    request<{
      used: boolean;
      itemName: string;
      remainingQuantity: number;
      message?: string;
    }>(`/inventory/use/${itemId}`, { method: 'POST' }),
  equipWeapon: (weaponId: string) =>
    request(`/inventory/weapons/equip/${weaponId}`, { method: 'POST' }),

  worldStreet: () => request('/world/street'),
  worldMap: () => request<WorldMapResponse>('/world/map'),
  worldTravel: (destinationId: string) =>
    request<WorldTravelResponse>('/world/travel', {
      method: 'POST',
      body: JSON.stringify({ destinationId }),
    }),
  worldAction: (actionId: string) =>
    request('/world/action', {
      method: 'POST',
      body: JSON.stringify({ actionId }),
    }),
  setLifestyle: (lifestyle: string) =>
    request('/world/lifestyle', {
      method: 'POST',
      body: JSON.stringify({ lifestyle }),
    }),
  worldMarket: () =>
    request<WorldMarketResponse | MarketItem[]>('/world/market'),
  tradeMarket: (goodId: string, action: 'BUY' | 'SELL', quantity: number) =>
    request<MarketTradeResponse>('/world/market/trade', {
      method: 'POST',
      body: JSON.stringify({ goodId, action, quantity }),
    }),

  // Factions & Pursuit
  factions: () =>
    request<
      | FactionInfo[]
      | {
          factions: FactionInfo[];
          currentFaction?: FactionType;
          factionRank?: number;
          jailUntil?: string | null;
        }
    >('/factions'),
  joinFaction: (faction: FactionType) =>
    request<{
      faction: FactionType;
      factionRank?: number;
      message?: string;
      player?: Partial<Player>;
    }>('/factions/join', {
      method: 'POST',
      body: JSON.stringify({ faction }),
    }),
  wantedList: () =>
    request<
      WantedSuspect[] | { suspects?: WantedSuspect[]; wanted?: WantedSuspect[] }
    >('/factions/wanted'),
  interceptWanted: (suspectPlayerId: string) =>
    request<InterceptResponse>('/factions/intercept', {
      method: 'POST',
      body: JSON.stringify({ suspectPlayerId }),
    }),
  payBail: () => request<BailResponse>('/factions/bail', { method: 'POST' }),

  // Heists
  heists: () => request<HeistsOverviewResponse>('/heists'),
  createHeist: (heistId: string, role?: HeistRole) =>
    request<HeistLobby>('/heists/create', {
      method: 'POST',
      body: JSON.stringify({ heistId, role }),
    }),
  joinHeist: (lobbyId: string, role: HeistRole) =>
    request<HeistLobby>(`/heists/${lobbyId}/join`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),
  leaveHeist: (lobbyId: string) =>
    request<{
      left: boolean;
      disbanded: boolean;
      lobbyId: string;
      message?: string;
    }>(`/heists/${lobbyId}/leave`, { method: 'POST' }),
  executeHeist: (lobbyId: string) =>
    request<HeistExecuteResponse>(`/heists/${lobbyId}/execute`, {
      method: 'POST',
    }),

  // Engagement (Daily Streak, Challenges, Referrals, Leaderboards)
  engagementStatus: () => request<EngagementStatus>('/engagement/status'),
  claimDaily: () =>
    request<{
      day: number;
      reward: { euros: number; vidaCoins: number; xp: number };
      player: Partial<Player>;
    }>('/engagement/daily-claim', { method: 'POST' }),
  claimDailyChallenge: (challengeId: string) =>
    request<{
      challengeId: string;
      reward: { euros: number; xp: number; vidaCoins: number };
      player: Partial<Player>;
    }>('/engagement/daily-challenges/claim', {
      method: 'POST',
      body: JSON.stringify({ challengeId }),
    }),
  leaderboards: () => request<LeaderboardsResponse>('/engagement/leaderboards'),
  worldEvent: () => request<WorldEventStatus>('/engagement/world-event'),
  participateWorldEvent: () =>
    request<{
      hourKey: string;
      eventId: string;
      title: string;
      city: string;
      vipBonusApplied: boolean;
      reward: {
        euros: number;
        xp: number;
        vidaCoins: number;
        battlePassXp: number;
      };
      player: Partial<Player>;
    }>('/engagement/world-event/participate', { method: 'POST' }),

  // Marketplace P2P & VIP Shop
  marketListings: () => request<MarketListing[]>('/marketplace/listings'),
  createMarketListing: (data: {
    inventoryItemId: string;
    quantity: number;
    priceEuros: number;
  }) =>
    request<MarketListing>('/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  buyMarketListing: (listingId: string) =>
    request<{
      listingId: string;
      itemName: string;
      quantity: number;
      priceEuros: number;
      feeEuros: number;
      sellerNetEuros: number;
    }>(`/marketplace/listings/${listingId}/buy`, { method: 'POST' }),
  cancelMarketListing: (listingId: string) =>
    request<{ cancelled: boolean; listingId: string }>(
      `/marketplace/listings/${listingId}/cancel`,
      { method: 'POST' },
    ),
  vipShop: () => request<VipShopOffer[]>('/marketplace/vip-shop'),
  buyVipOffer: (offerId: string) =>
    request<{
      offerId: string;
      name: string;
      priceVida: number;
      detail: string;
    }>('/marketplace/vip-shop/buy', {
      method: 'POST',
      body: JSON.stringify({ offerId }),
    }),

  // Admin & Moderation
  adminOverview: () => request<AdminOverviewResponse>('/admin/overview'),
  adminBanPlayer: (playerId: string, isBanned: boolean, reason?: string) =>
    request(`/admin/players/${playerId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ isBanned, reason }),
    }),
  adminGrantVip: (
    playerId: string,
    data: { days?: number; vidaCoins?: number; reason?: string },
  ) =>
    request(`/admin/players/${playerId}/grant-vip`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Street Combat (+18)
  worldCombat: (data: {
    targetType: 'THUG' | 'ENFORCER' | 'RIVAL_CAR';
    weaponUsed?: string;
  }) =>
    request<StreetCombatResponse>('/world/combat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Clandestine Casino (+18)
  casinoStatus: () => request<CasinoStatusResponse>('/casino/status'),
  casinoRoulette: (data: {
    bet: number;
    currency?: 'EUR' | 'VIDACOIN';
    betType: CasinoRouletteBetType;
    number?: number;
  }) =>
    request<CasinoRouletteResponse>('/casino/roulette', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  casinoDice: (data: {
    bet: number;
    currency?: 'EUR' | 'VIDACOIN';
    choice: CasinoDiceChoice;
  }) =>
    request<CasinoDiceResponse>('/casino/dice', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  casinoBlackjackStart: (data: {
    bet: number;
    currency?: 'EUR' | 'VIDACOIN';
  }) =>
    request<CasinoBlackjackResponse>('/casino/blackjack/start', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  casinoBlackjackAction: (data: {
    handId: string;
    action: 'HIT' | 'STAND' | 'DOUBLE';
  }) =>
    request<CasinoBlackjackResponse>('/casino/blackjack/action', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
