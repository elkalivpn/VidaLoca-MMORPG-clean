export type ZoneVibe = 'business' | 'nightlife' | 'luxury' | 'street';

export interface ZoneDef {
  id: string;
  name: string;
  city: string;
  description: string;
  vibe: ZoneVibe;
  lng: number;
  lat: number;
}

export interface HighwayRoute {
  id: string;
  highway: string;
  name: string;
  from: string;
  to: string;
  distanceKm: number;
  tollEuros: number;
}

export const ZONES: ZoneDef[] = [
  {
    id: 'madrid_centro',
    name: 'Sol / Gran Vía',
    city: 'Madrid',
    description:
      'El kilómetro cero de España. Oficinas, despachos discretos, tráfico constante y dinero rápido.',
    vibe: 'business',
    lng: -3.7038,
    lat: 40.4168,
  },
  {
    id: 'malasana',
    name: 'Malasaña',
    city: 'Madrid',
    description:
      'Garitos de madrugada, neones, trapicheos entre callejones y contactos de la noche madrileña.',
    vibe: 'nightlife',
    lng: -3.7058,
    lat: 40.426,
  },
  {
    id: 'salamanca',
    name: 'Barrio de Salamanca',
    city: 'Madrid',
    description:
      'Boutiques de lujo, coches de alta gama en doble fila y tratos de guante blanco.',
    vibe: 'luxury',
    lng: -3.6838,
    lat: 40.4295,
  },
  {
    id: 'barcelona_ramblas',
    name: 'Las Ramblas',
    city: 'Barcelona',
    description:
      'Bullir incesante de turistas, carteristas expertos y mercancía que entra por el puerto.',
    vibe: 'street',
    lng: 2.1734,
    lat: 41.3809,
  },
  {
    id: 'barcelona_gotico',
    name: 'Barrio Gótico',
    city: 'Barcelona',
    description:
      'Calles estrechas de piedra donde se pierden los perseguidores y se cierran pactos en la sombra.',
    vibe: 'street',
    lng: 2.1769,
    lat: 41.3833,
  },
  {
    id: 'marbella_centro',
    name: 'Marbella Centro',
    city: 'Marbella',
    description:
      'Sol de la Costa del Sol, capital discreto y villas vigiladas frente al Mediterráneo.',
    vibe: 'luxury',
    lng: -4.8856,
    lat: 36.5101,
  },
  {
    id: 'puerto_banus',
    name: 'Puerto Banús',
    city: 'Marbella',
    description:
      'Yates, superdeportivos, relojes de seis cifras y la élite más turbia de Europa.',
    vibe: 'luxury',
    lng: -4.9526,
    lat: 36.4879,
  },
  {
    id: 'sevilla_casco',
    name: 'Casco Antiguo',
    city: 'Sevilla',
    description:
      'Calor del sur, callejuelas del Arenal y Triana, y rutas clave hacia el Estrecho.',
    vibe: 'street',
    lng: -5.9845,
    lat: 37.3891,
  },
  {
    id: 'valencia_artes',
    name: 'Ciudad de las Artes',
    city: 'Valencia',
    description:
      'Avenidas amplias, puerto estratégico del Levante y negocios de importación y exportación.',
    vibe: 'business',
    lng: -0.3505,
    lat: 39.4549,
  },
  {
    id: 'bilbao_casco',
    name: 'Casco Viejo',
    city: 'Bilbao',
    description:
      'Las Siete Calles bajo la lluvia del norte. Lealtad de hierro y rutas hacia la frontera.',
    vibe: 'street',
    lng: -2.9234,
    lat: 43.257,
  },
];

export const ZONES_BY_ID: Record<string, ZoneDef> = ZONES.reduce(
  (acc, zone) => {
    acc[zone.id] = zone;
    return acc;
  },
  {} as Record<string, ZoneDef>,
);

/**
 * Grafo bidireccional de autopistas y autovías reales de España.
 */
export const HIGHWAY_ROUTES: HighwayRoute[] = [
  {
    id: 'a1-madrid-bilbao',
    highway: 'A-1',
    name: 'Autovía del Norte (A-1)',
    from: 'madrid_centro',
    to: 'bilbao_casco',
    distanceKm: 395,
    tollEuros: 18,
  },
  {
    id: 'a2-madrid-barcelona',
    highway: 'A-2',
    name: 'Autovía del Nordeste (A-2 / AP-2)',
    from: 'madrid_centro',
    to: 'barcelona_ramblas',
    distanceKm: 620,
    tollEuros: 22,
  },
  {
    id: 'a3-madrid-valencia',
    highway: 'A-3',
    name: 'Autovía del Este (A-3)',
    from: 'madrid_centro',
    to: 'valencia_artes',
    distanceKm: 355,
    tollEuros: 0,
  },
  {
    id: 'a4-madrid-sevilla',
    highway: 'A-4',
    name: 'Autovía del Sur (A-4)',
    from: 'madrid_centro',
    to: 'sevilla_casco',
    distanceKm: 530,
    tollEuros: 0,
  },
  {
    id: 'ap7-barcelona-valencia',
    highway: 'AP-7',
    name: 'Autopista del Mediterráneo (AP-7)',
    from: 'barcelona_ramblas',
    to: 'valencia_artes',
    distanceKm: 350,
    tollEuros: 14,
  },
  {
    id: 'a7-valencia-marbella',
    highway: 'A-7',
    name: 'Autovía del Mediterráneo (A-7)',
    from: 'valencia_artes',
    to: 'marbella_centro',
    distanceKm: 630,
    tollEuros: 8,
  },
  {
    id: 'a92-sevilla-marbella',
    highway: 'A-92',
    name: 'Autovía de Andalucía / Costa del Sol (A-92 / AP-46)',
    from: 'sevilla_casco',
    to: 'marbella_centro',
    distanceKm: 255,
    tollEuros: 6,
  },
  {
    id: 'ap68-bilbao-barcelona',
    highway: 'AP-68',
    name: 'Autopista Vasco-Aragonesa (AP-68 / AP-2)',
    from: 'bilbao_casco',
    to: 'barcelona_ramblas',
    distanceKm: 610,
    tollEuros: 32,
  },
];

export const ZONE_VIBES: Record<string, string> = ZONES.reduce(
  (acc, zone) => {
    acc[zone.id] = zone.vibe;
    return acc;
  },
  {} as Record<string, string>,
);

export const VALID_ZONE_IDS = ZONES.map((z) => z.id);

export function isValidZoneId(locationId: string): boolean {
  return Object.prototype.hasOwnProperty.call(ZONES_BY_ID, locationId);
}

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export interface RouteCalculation {
  distanceKm: number;
  highway: string;
  tollEuros: number;
  isIntercity: boolean;
}

function getCityHubZoneId(city: string): string | null {
  const hub = ZONES.find(
    (z) =>
      z.city === city &&
      HIGHWAY_ROUTES.some((r) => r.from === z.id || r.to === z.id),
  );
  return hub ? hub.id : null;
}

function dijkstraHighway(
  startId: string,
  endId: string,
): { distanceKm: number; highways: string[]; tollEuros: number } | null {
  if (startId === endId) {
    return { distanceKm: 0, highways: [], tollEuros: 0 };
  }

  const adj: Record<
    string,
    Array<{ to: string; distanceKm: number; highway: string; tollEuros: number }>
  > = {};

  for (const route of HIGHWAY_ROUTES) {
    if (!adj[route.from]) adj[route.from] = [];
    if (!adj[route.to]) adj[route.to] = [];
    adj[route.from].push({
      to: route.to,
      distanceKm: route.distanceKm,
      highway: route.highway,
      tollEuros: route.tollEuros,
    });
    adj[route.to].push({
      to: route.from,
      distanceKm: route.distanceKm,
      highway: route.highway,
      tollEuros: route.tollEuros,
    });
  }

  if (!adj[startId] || !adj[endId]) {
    return null;
  }

  const dist: Record<string, number> = { [startId]: 0 };
  const prev: Record<
    string,
    { node: string; highway: string; tollEuros: number } | undefined
  > = {};
  const visited = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    queue.sort((a, b) => (dist[a] ?? Infinity) - (dist[b] ?? Infinity));
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endId) break;

    for (const edge of adj[current] ?? []) {
      const alt = (dist[current] ?? Infinity) + edge.distanceKm;
      if (alt < (dist[edge.to] ?? Infinity)) {
        dist[edge.to] = alt;
        prev[edge.to] = {
          node: current,
          highway: edge.highway,
          tollEuros: edge.tollEuros,
        };
        queue.push(edge.to);
      }
    }
  }

  if (dist[endId] === undefined) {
    return null;
  }

  const highways: string[] = [];
  let tollEuros = 0;
  let curr: string | undefined = endId;
  while (curr && curr !== startId) {
    const step = prev[curr];
    if (!step) break;
    highways.unshift(step.highway);
    tollEuros += step.tollEuros;
    curr = step.node;
  }

  return {
    distanceKm: dist[endId],
    highways,
    tollEuros,
  };
}

export function calculateRouteBetweenZones(
  fromId: string,
  toId: string,
): RouteCalculation {
  const fromZone = ZONES_BY_ID[fromId];
  const toZone = ZONES_BY_ID[toId];

  if (!fromZone || !toZone) {
    throw new Error(`Invalid zone id(s): ${fromId} -> ${toId}`);
  }

  if (fromZone.city === toZone.city) {
    const km = Math.max(
      1,
      Math.round(haversineDistanceKm(fromZone, toZone) * 10) / 10,
    );
    return {
      distanceKm: km,
      highway: 'Urbano',
      tollEuros: 0,
      isIntercity: false,
    };
  }

  const direct = dijkstraHighway(fromId, toId);
  if (direct) {
    return {
      distanceKm: direct.distanceKm,
      highway: direct.highways.join(' + '),
      tollEuros: direct.tollEuros,
      isIntercity: true,
    };
  }

  const fromHubId = getCityHubZoneId(fromZone.city);
  const toHubId = getCityHubZoneId(toZone.city);

  if (fromHubId && toHubId) {
    const trunk = dijkstraHighway(fromHubId, toHubId);
    if (trunk) {
      const firstLeg =
        fromId === fromHubId
          ? 0
          : haversineDistanceKm(fromZone, ZONES_BY_ID[fromHubId]);
      const lastLeg =
        toId === toHubId
          ? 0
          : haversineDistanceKm(ZONES_BY_ID[toHubId], toZone);
      const totalKm = Math.round((firstLeg + trunk.distanceKm + lastLeg) * 10) / 10;
      return {
        distanceKm: totalKm,
        highway: trunk.highways.join(' + ') || 'Urbano',
        tollEuros: trunk.tollEuros,
        isIntercity: true,
      };
    }
  }

  // Fallback por carretera nacional si no hubiese conexión en el grafo
  const fallbackKm = Math.max(
    10,
    Math.round(haversineDistanceKm(fromZone, toZone) * 1.25 * 10) / 10,
  );
  return {
    distanceKm: fallbackKm,
    highway: 'Nacional',
    tollEuros: 0,
    isIntercity: true,
  };
}
