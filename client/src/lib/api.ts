const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type ApiSuccess<T> = { success: true; data: T; timestamp: string };
type ApiError = {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
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

  const body = await res.json().catch(() => ({}));

  if (!res.ok || body.success === false) {
    const err = body as ApiError;
    const msg = Array.isArray(err.message)
      ? err.message.join(', ')
      : err.message || `Error ${res.status}`;
    throw new Error(msg);
  }

  if (body && typeof body === 'object' && 'data' in body && body.success === true) {
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
  }) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  me: () => request('/players/me'),
  updateLocation: (locationId: string) =>
    request('/players/location', {
      method: 'POST',
      body: JSON.stringify({ locationId }),
    }),

  missionTemplates: (difficulty?: string) =>
    request(`/missions/templates${difficulty ? `?difficulty=${difficulty}` : ''}`),
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

  inventory: () => request('/inventory'),
  equipItem: (itemId: string) =>
    request(`/inventory/equip/${itemId}`, { method: 'POST' }),
  equipWeapon: (weaponId: string) =>
    request(`/inventory/weapons/equip/${weaponId}`, { method: 'POST' }),

  health: () => request('/health'),
};
