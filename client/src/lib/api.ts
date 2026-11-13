import type {
  BailResponse,
  FactionInfo,
  FactionType,
  HeistExecuteResponse,
  HeistLobby,
  HeistRole,
  HeistsOverviewResponse,
  InterceptResponse,
  MarketItem,
  MarketTradeResponse,
  Player,
  PropertyUseResponse,
  WantedSuspect,
  WorldMapResponse,
  WorldMarketResponse,
  WorldTravelResponse,
} from '@/types/game';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
  }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  me: () => request('/players/me'),
  updateLocation: (locationId: string) =>
    request('/players/location', {
      method: 'POST',
      body: JSON.stringify({ locationId }),
    }),

  missionTemplates: (difficulty?: string) =>
    request(
      `/missions/templates${difficulty ? `?difficulty=${difficulty}` : ''}`,
    ),
  myMissions: () => request('/missions/my'),
  startMission: (templateId: string) =>
    request('/missions/start', {
      method: 'POST',
      body: JSON.stringify({ templateId }),
    }),
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
  buyVehicle: (templateId: string, color?: string) =>
    request('/vehicles/buy', {
      method: 'POST',
      body: JSON.stringify({ templateId, color }),
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
  clanLeaderboard: () => request('/clans/leaderboard'),
  territories: () => request('/clans/territories'),
  claimTerritory: (territoryId: string) =>
    request(`/clans/territories/${territoryId}/claim`, { method: 'POST' }),

  // Inventory
  inventory: () => request('/inventory'),
  equipItem: (itemId: string) =>
    request(`/inventory/equip/${itemId}`, { method: 'POST' }),
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
  tradeMarket: (itemId: string, action: 'BUY' | 'SELL', quantity: number) =>
    request<MarketTradeResponse>('/world/market/trade', {
      method: 'POST',
      body: JSON.stringify({ itemId, action, quantity }),
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
  interceptWanted: (targetPlayerId: string) =>
    request<InterceptResponse>('/factions/intercept', {
      method: 'POST',
      body: JSON.stringify({ targetPlayerId }),
    }),
  payBail: () => request<BailResponse>('/factions/bail', { method: 'POST' }),

  // Heists
  heists: () => request<HeistsOverviewResponse>('/heists'),
  createHeist: (templateId: string) =>
    request<HeistLobby>('/heists/create', {
      method: 'POST',
      body: JSON.stringify({ templateId }),
    }),
  joinHeist: (lobbyId: string, role: HeistRole) =>
    request<HeistLobby>(`/heists/${lobbyId}/join`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),
  executeHeist: (lobbyId: string) =>
    request<HeistExecuteResponse>(`/heists/${lobbyId}/execute`, {
      method: 'POST',
    }),
};
