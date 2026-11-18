'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import {
  CITIES,
  SPAIN_HIGHWAYS,
  VIBE_COLORS,
  VIBE_HEX_COLORS,
  VIBE_LABELS,
} from '@/data/cities';
import type {
  CityLocation,
  WorldMapResponse,
  WorldTravelResponse,
} from '@/types/game';

const OFFLINE_SPAIN_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'VidaLoca Iberia Dark',
  sources: {
    'spain-land': {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { region: 'Peninsula Ibérica' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-9.3, 43.0],
                  [-8.8, 43.45],
                  [-7.0, 43.6],
                  [-5.6, 43.6],
                  [-3.8, 43.48],
                  [-1.78, 43.38],
                  [0.7, 42.75],
                  [3.32, 42.45],
                  [2.2, 41.38],
                  [0.85, 40.7],
                  [0.12, 39.4],
                  [0.2, 38.7],
                  [-0.7, 37.6],
                  [-2.1, 36.72],
                  [-4.4, 36.7],
                  [-5.45, 36.0],
                  [-6.3, 36.5],
                  [-7.4, 37.18],
                  [-8.95, 37.02],
                  [-9.5, 38.7],
                  [-8.9, 41.15],
                  [-8.85, 42.15],
                  [-9.3, 43.0],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: { region: 'Mallorca' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [2.35, 39.55],
                  [2.75, 39.92],
                  [3.48, 39.75],
                  [3.2, 39.28],
                  [2.58, 39.42],
                  [2.35, 39.55],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: { region: 'Ibiza' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [1.18, 38.92],
                  [1.58, 39.12],
                  [1.62, 38.84],
                  [1.26, 38.82],
                  [1.18, 38.92],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: { region: 'Tenerife' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-16.92, 28.35],
                  [-16.15, 28.58],
                  [-16.32, 28.05],
                  [-16.82, 28.02],
                  [-16.92, 28.35],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: { region: 'Gran Canaria' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-15.82, 28.0],
                  [-15.42, 28.18],
                  [-15.36, 27.76],
                  [-15.78, 27.74],
                  [-15.82, 28.0],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: { region: 'Lanzarote' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-13.85, 29.22],
                  [-13.45, 29.24],
                  [-13.52, 28.84],
                  [-13.88, 28.86],
                  [-13.85, 29.22],
                ],
              ],
            },
          },
        ],
      },
    },
  },
  layers: [
    {
      id: 'ocean-bg',
      type: 'background',
      paint: {
        'background-color': '#050914',
      },
    },
    {
      id: 'spain-land-fill',
      type: 'fill',
      source: 'spain-land',
      paint: {
        'fill-color': '#111827',
        'fill-opacity': 0.96,
      },
    },
    {
      id: 'spain-coast-glow',
      type: 'line',
      source: 'spain-land',
      paint: {
        'line-color': '#38bdf8',
        'line-width': 2.2,
        'line-opacity': 0.35,
      },
    },
  ],
};
const SPAIN_CENTER: [number, number] = [-3.7038, 40.4168];
const SPAIN_ZOOM = 5.5;

const MARKER_OFFSETS: Record<string, [number, number]> = {
  madrid_centro: [-18, 6],
  malasana: [-18, -14],
  salamanca: [22, -6],
  puerto_banus: [-14, 4],
  malaga_soho: [16, -6],
};

interface MergedZone extends CityLocation {
  clanTag?: string | null;
  clanName?: string | null;
  playerCount?: number;
}

interface RouteEstimate {
  distanceKm: number;
  highway: string;
  costEuros: number;
  durationLabel: string;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function inferHighway(from: CityLocation, to: CityLocation): string {
  if (from.city === to.city) {
    if (from.city === 'Madrid') return 'M-30 / Red Urbana Madrid';
    if (from.city === 'Barcelona') return 'Ronda Litoral B-10';
    if (from.city === 'Marbella') return 'N-340 / A-7 Costa del Sol';
    return `Red Urbana ${from.city}`;
  }
  const cities = new Set([from.city, to.city]);
  if (
    cities.has('Las Palmas') ||
    cities.has('Tenerife') ||
    cities.has('Lanzarote')
  ) {
    if (
      (cities.has('Las Palmas') && cities.has('Tenerife')) ||
      (cities.has('Las Palmas') && cities.has('Lanzarote')) ||
      (cities.has('Tenerife') && cities.has('Lanzarote'))
    ) {
      return 'Ferry Canario / Binter';
    }
    return 'Puente Aéreo Atlántico';
  }
  if (cities.has('Palma') || cities.has('Ibiza')) {
    if (cities.has('Palma') && cities.has('Ibiza')) {
      return 'Ferry Interinsular Balear';
    }
    return 'Ferry / Puente Aéreo Balear';
  }
  if (
    cities.has('A Coruña') ||
    cities.has('Vigo') ||
    cities.has('Santiago de Compostela')
  ) {
    return 'Corredor A-6 / AP-9 Galicia';
  }
  if (cities.has('Gijón') || cities.has('Santander')) {
    return 'Autovía del Cantábrico A-8 / A-66';
  }
  if (cities.has('Pamplona')) {
    return 'Autopista AP-15 / A-15 Navarra';
  }
  if (
    cities.has('San Sebastián') ||
    cities.has('Vitoria-Gasteiz') ||
    cities.has('Bilbao')
  ) {
    return 'Autopista AP-8 / AP-68 País Vasco';
  }
  if (cities.has('Málaga') || cities.has('Granada')) {
    return 'Autovía A-92 / AP-7 Andalucía';
  }
  if (cities.has('Alicante') || cities.has('Murcia')) {
    return 'Corredor Mediterráneo A-7 / A-31';
  }
  if (cities.has('Madrid') && cities.has('Toledo')) return 'Autovía A-42';
  if (cities.has('Madrid') && cities.has('Valladolid'))
    return 'Autovía A-6 / A-601';
  if (cities.has('Valladolid') && cities.has('Salamanca'))
    return 'Autovía A-62';
  if (cities.has('Madrid') && cities.has('Zaragoza')) return 'Autovía A-2';
  if (cities.has('Madrid') && cities.has('Barcelona'))
    return 'Autovía A-2 / AP-2';
  if (cities.has('Madrid') && cities.has('Valencia')) return 'Autovía A-3';
  if (cities.has('Madrid') && cities.has('Sevilla')) return 'Autovía A-4';
  if (cities.has('Madrid') && cities.has('Marbella'))
    return 'Autovía A-4 / A-45 / AP-7';
  if (cities.has('Barcelona') && cities.has('Valencia'))
    return 'Autopista del Mediterráneo AP-7';
  if (cities.has('Barcelona') && cities.has('Marbella'))
    return 'Corredor Mediterráneo AP-7 / A-7';
  if (cities.has('Valencia') && cities.has('Marbella'))
    return 'Autovía A-7 / AP-7';
  if (cities.has('Sevilla') && cities.has('Marbella'))
    return 'Autovía A-92 / AP-7';
  return 'Red de Autovías del Estado';
}

function estimateRoute(
  from: CityLocation,
  to: CityLocation,
  vehicleSpeed?: number,
  backendHighway?: string,
  backendDistanceKm?: number,
  hasVehicle = false,
): RouteEstimate {
  const straight = haversineKm(from, to);
  const roadKm =
    backendDistanceKm ??
    (from.id === to.id ? 0 : Math.max(4, Math.round(straight * 1.18)));
  const highway = backendHighway ?? inferHighway(from, to);
  const isIntercity = from.city !== to.city;
  let costEuros = 0;
  if (from.id !== to.id) {
    if (hasVehicle) {
      costEuros = isIntercity
        ? Math.round((roadKm * 0.12 + 5) * 100) / 100
        : Math.max(1, Math.round(roadKm * 0.4 * 100) / 100);
    } else {
      costEuros = isIntercity
        ? Math.max(15, Math.round(roadKm * 0.18 * 100) / 100)
        : 3;
    }
  }
  const avgKmh = vehicleSpeed ? Math.min(185, 85 + vehicleSpeed * 0.5) : 100;
  const totalMinutes =
    from.id === to.id ? 0 : Math.max(8, Math.round((roadKm / avgKmh) * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const durationLabel = h > 0 ? `${h}h ${m}m` : `${m} min`;
  return { distanceKm: roadKm, highway, costEuros, durationLabel };
}

function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

export default function CityMap({
  onZoneChanged,
}: {
  onZoneChanged?: (zoneId: string) => void;
}) {
  const { token, player, refreshPlayer } = useAuth();
  const hereId = player?.locationId || 'madrid_centro';

  const [mapData, setMapData] = useState<WorldMapResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string>(hereId);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [travelResult, setTravelResult] = useState<WorldTravelResponse | null>(
    null,
  );
  const [webglOk, setWebglOk] = useState<boolean>(true);
  const [mapReady, setMapReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);

  const primaryVehicle = useMemo(() => {
    const list = player?.vehicles ?? [];
    return list.find((v) => v.isPrimary) ?? list[0] ?? null;
  }, [player?.vehicles]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .worldMap()
      .then((res) => {
        if (!cancelled) setMapData(res);
      })
      .catch(() => {
        // Fallback silently to local CITIES & SPAIN_HIGHWAYS if /world/map is unavailable
      });
    return () => {
      cancelled = true;
    };
  }, [token, hereId]);

  const zones: MergedZone[] = useMemo(() => {
    return CITIES.map((base) => {
      const apiZone = mapData?.zones?.find((z) => z.id === base.id);
      const apiTerritory = mapData?.territories?.find(
        (t) =>
          t.locationId === base.id ||
          t.zoneId === base.id ||
          (t.city && t.city.toLowerCase() === base.city.toLowerCase()),
      );
      const clan =
        apiZone?.controlledByClan ??
        apiTerritory?.controller ??
        apiTerritory?.clan ??
        null;
      return {
        ...base,
        lng: apiZone?.lng ?? base.lng,
        lat: apiZone?.lat ?? base.lat,
        clanTag: apiZone?.clanTag ?? clan?.tag ?? null,
        clanName: apiZone?.clanName ?? clan?.name ?? null,
        playerCount: apiZone?.playerCount,
      };
    });
  }, [mapData]);

  const currentZone = useMemo(
    () => zones.find((z) => z.id === hereId) ?? zones[0],
    [zones, hereId],
  );

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedId) ?? currentZone,
    [zones, selectedId, currentZone],
  );

  const routeInfo = useMemo(() => {
    const backendRoute = mapData?.routes?.find(
      (r) =>
        (r.from === currentZone.id && r.to === selectedZone.id) ||
        (r.to === currentZone.id && r.from === selectedZone.id),
    );
    return estimateRoute(
      currentZone,
      selectedZone,
      primaryVehicle?.template.speed,
      backendRoute?.highway,
      backendRoute?.distanceKm,
      Boolean(primaryVehicle),
    );
  }, [currentZone, selectedZone, primaryVehicle, mapData?.routes]);

  // Initialize MapLibre GL JS with offline-proof inline Iberian vector style
  useEffect(() => {
    if (!isWebGLAvailable()) {
      setWebglOk(false);
      return;
    }
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    let map: MapLibreMap;
    try {
      maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
      map = new maplibregl.Map({
        container,
        style: OFFLINE_SPAIN_STYLE,
        center: SPAIN_CENTER,
        zoom: SPAIN_ZOOM,
        minZoom: 4.5,
        maxZoom: 14,
        attributionControl: false,
      });
    } catch {
      setWebglOk(false);
      return;
    }

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      'top-right',
    );

    map.on('error', () => {
      setWebglOk(false);
    });

    map.on('load', () => {
      const highwayFeatures = SPAIN_HIGHWAYS.map((hw) => ({
        type: 'Feature' as const,
        properties: { id: hw.id, name: hw.name },
        geometry: {
          type: 'LineString' as const,
          coordinates: hw.coordinates,
        },
      }));

      map.addSource('spain-highways', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: highwayFeatures,
        },
      });

      map.addLayer({
        id: 'spain-highways-glow',
        type: 'line',
        source: 'spain-highways',
        paint: {
          'line-color': '#f59e0b',
          'line-width': 5,
          'line-opacity': 0.18,
        },
      });

      map.addLayer({
        id: 'spain-highways-line',
        type: 'line',
        source: 'spain-highways',
        paint: {
          'line-color': '#fbbf24',
          'line-width': 2,
          'line-opacity': 0.65,
          'line-dasharray': [2, 1.5],
        },
      });

      map.addSource('selected-route', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'selected-route-line',
        type: 'line',
        source: 'selected-route',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 3.5,
          'line-opacity': 0.9,
        },
      });

      setMapReady(true);
    });

    mapInstanceRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Update active route GeoJSON line when origin or destination changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource<GeoJSONSource>('selected-route');
    if (!src) return;

    if (currentZone.id === selectedZone.id) {
      void src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    void src.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [currentZone.lng, currentZone.lat],
              [selectedZone.lng, selectedZone.lat],
            ],
          },
        },
      ],
    });
  }, [mapReady, currentZone, selectedZone]);

  // Render interactive DOM markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !webglOk) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    zones.forEach((zone) => {
      const isHere = zone.id === hereId;
      const isSelected = zone.id === selectedZone.id;
      const hex = VIBE_HEX_COLORS[zone.vibe];
      const offset = MARKER_OFFSETS[zone.id] ?? [0, 0];

      const el = document.createElement('button');
      el.type = 'button';
      el.title = `${zone.name} (${zone.city})`;
      el.className =
        'group relative flex flex-col items-center cursor-pointer focus:outline-none hover:z-30';
      if (isHere || isSelected) {
        el.style.zIndex = '25';
      }

      const ring = document.createElement('span');
      ring.className = `flex items-center justify-center rounded-full transition-transform duration-150 ${
        isHere
          ? 'h-5 w-5 ring-4 ring-emerald-400/50 scale-110'
          : isSelected
            ? 'h-4.5 w-4.5 ring-4 ring-sky-400/60 scale-110'
            : 'h-3.5 w-3.5 hover:scale-125'
      }`;
      ring.style.backgroundColor = hex;
      ring.style.border = isHere ? '2px solid #ecfdf5' : '2px solid #18181b';
      ring.style.boxShadow = `0 0 12px ${hex}`;
      el.appendChild(ring);

      const labelWrap = document.createElement('span');
      labelWrap.className =
        'mt-1 flex items-center gap-1 rounded bg-zinc-950/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-100 border border-zinc-800 whitespace-nowrap shadow-md';
      labelWrap.textContent = zone.name;

      if (isHere) {
        const youBadge = document.createElement('span');
        youBadge.className =
          'rounded bg-emerald-500/20 px-1 text-[9px] font-bold text-emerald-300';
        youBadge.textContent = 'TÚ';
        labelWrap.appendChild(youBadge);
      }
      if (zone.clanTag) {
        const clanBadge = document.createElement('span');
        clanBadge.className =
          'rounded bg-amber-500/20 px-1 text-[9px] font-semibold text-amber-300';
        clanBadge.textContent = `[${zone.clanTag}]`;
        labelWrap.appendChild(clanBadge);
      }

      el.appendChild(labelWrap);

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectZone(zone);
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'top',
        offset,
      })
        .setLngLat([zone.lng, zone.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [zones, hereId, selectedZone.id, webglOk]);

  function selectZone(zone: MergedZone) {
    setSelectedId(zone.id);
    setErrorMsg('');
    const map = mapInstanceRef.current;
    if (map) {
      map.easeTo({
        center: [zone.lng, zone.lat],
        zoom: Math.max(map.getZoom(), 6.3),
        duration: 650,
      });
    }
  }

  function resetSpainView() {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo({
        center: SPAIN_CENTER,
        zoom: SPAIN_ZOOM,
        duration: 750,
      });
    }
  }

  function flyToRegion(center: [number, number], zoom: number) {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo({ center, zoom, duration: 750 });
    }
  }

  async function handleTravel(zoneId: string) {
    if (!token || busy || zoneId === hereId) return;
    setBusy(true);
    setErrorMsg('');
    setTravelResult(null);
    try {
      const res = await api.worldTravel(zoneId);
      setTravelResult(res);
      onZoneChanged?.(zoneId);
      await refreshPlayer();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al viajar');
    } finally {
      setBusy(false);
    }
  }

  const guardiaEncounter = Boolean(
    travelResult?.guardiaCivil?.encountered ||
    travelResult?.checkpoint?.triggered ||
    travelResult?.narrative?.toLowerCase().includes('guardia civil'),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-400">
            Mapa Interactivo de España
          </h2>
          <p className="text-xs text-zinc-400">
            Ubicación actual:{' '}
            <span className="font-medium text-emerald-300">
              {currentZone.name} ({currentZone.city})
            </span>
            {primaryVehicle && (
              <span className="ml-2 text-zinc-500">
                · Vehículo: {primaryVehicle.template.brand}{' '}
                {primaryVehicle.template.name}
              </span>
            )}
          </p>
        </div>

        {webglOk && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={resetSpainView}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/50 hover:text-amber-300"
            >
              Península
            </button>
            <button
              type="button"
              onClick={() => flyToRegion([-5.6, 42.9], 6.4)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/50 hover:text-amber-300"
            >
              Galicia & Norte
            </button>
            <button
              type="button"
              onClick={() => flyToRegion([2.1, 39.3], 7.4)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/50 hover:text-amber-300"
            >
              Baleares
            </button>
            <button
              type="button"
              onClick={() => flyToRegion([-15.85, 28.25], 7.6)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/50 hover:text-amber-300"
            >
              Canarias
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {errorMsg}
        </div>
      )}

      {travelResult && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            guardiaEncounter
              ? 'border-sky-500/50 bg-sky-950/40 text-sky-100'
              : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <span>
              {guardiaEncounter
                ? 'Control de Guardia Civil en ruta'
                : 'Llegada confirmada'}
            </span>
            {travelResult.highway && (
              <span className="rounded bg-zinc-900/80 px-2 py-0.5 text-[11px] font-normal text-amber-300">
                {travelResult.highway}
              </span>
            )}
            {typeof travelResult.distanceKm === 'number' && (
              <span className="text-xs font-normal text-zinc-300">
                · {travelResult.distanceKm} km
              </span>
            )}
            {typeof travelResult.costEuros === 'number' && (
              <span className="text-xs font-normal text-zinc-300">
                · {travelResult.costEuros} €
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-200">
            {travelResult.narrative ||
              `Has llegado a ${selectedZone.name} (${selectedZone.city}).`}
          </p>
          {(travelResult.guardiaCivil?.message ||
            travelResult.checkpoint?.message) && (
            <p className="mt-1 text-xs font-medium text-amber-300">
              {travelResult.guardiaCivil?.message ||
                travelResult.checkpoint?.message}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        {/* Map Viewport (MapLibre GL JS or Schematic Fallback) */}
        <div className="relative min-h-[460px] lg:min-h-[540px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
          {webglOk ? (
            <div
              ref={mapContainerRef}
              className="h-full w-full min-h-[460px]"
            />
          ) : (
            <div className="relative h-full min-h-[460px] w-full bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.08),rgba(9,9,11,0.98))] p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                <span>Modo esquemático (WebGL no disponible)</span>
                <span className="text-amber-400">
                  España + Baleares + Canarias
                </span>
              </div>
              <svg
                viewBox="0 0 100 100"
                className="h-[390px] w-full rounded-lg border border-zinc-800/80 bg-zinc-900/40"
              >
                {/* Canarias inset frame */}
                <rect
                  x="4"
                  y="78"
                  width="24"
                  height="18"
                  rx="2"
                  fill="rgba(14,165,233,0.06)"
                  stroke="#38bdf8"
                  strokeOpacity="0.35"
                  strokeWidth="0.4"
                  strokeDasharray="1 1"
                />
                {/* Schematic Iberian, Balearic & Atlantic corridors */}
                <line
                  x1="48"
                  y1="44"
                  x2="42"
                  y2="16"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="42"
                  y1="16"
                  x2="52"
                  y2="15"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="48"
                  y1="44"
                  x2="39"
                  y2="31"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="39"
                  y1="31"
                  x2="31"
                  y2="37"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="39"
                  y1="31"
                  x2="16"
                  y2="15"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="16"
                  y1="15"
                  x2="15"
                  y2="21"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="15"
                  y1="21"
                  x2="14"
                  y2="27"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="48"
                  y1="44"
                  x2="61"
                  y2="30"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="61"
                  y1="30"
                  x2="74"
                  y2="28"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="48"
                  y1="44"
                  x2="64"
                  y2="53"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="48"
                  y1="44"
                  x2="45"
                  y2="50"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="45"
                  y1="50"
                  x2="31"
                  y2="69"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="74"
                  y1="28"
                  x2="64"
                  y2="53"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="64"
                  y1="53"
                  x2="39"
                  y2="78"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="31"
                  y1="69"
                  x2="39"
                  y2="78"
                  stroke="#f59e0b"
                  strokeOpacity="0.45"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1"
                />
                <line
                  x1="64"
                  y1="53"
                  x2="78"
                  y2="57"
                  stroke="#38bdf8"
                  strokeOpacity="0.45"
                  strokeWidth="0.5"
                  strokeDasharray="1 1"
                />
                <line
                  x1="78"
                  y1="57"
                  x2="86"
                  y2="49"
                  stroke="#38bdf8"
                  strokeOpacity="0.45"
                  strokeWidth="0.5"
                  strokeDasharray="1 1"
                />
                <line
                  x1="74"
                  y1="28"
                  x2="86"
                  y2="49"
                  stroke="#38bdf8"
                  strokeOpacity="0.45"
                  strokeWidth="0.5"
                  strokeDasharray="1 1"
                />
                <line
                  x1="11"
                  y1="85"
                  x2="20"
                  y2="88"
                  stroke="#38bdf8"
                  strokeOpacity="0.5"
                  strokeWidth="0.55"
                  strokeDasharray="1 1"
                />
              </svg>
              {zones.map((z) => {
                const isHere = z.id === hereId;
                const isSelected = z.id === selectedZone.id;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => selectZone(z)}
                    style={{ left: `${z.x ?? 50}%`, top: `${z.y ?? 50}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  >
                    <span
                      className={`h-3.5 w-3.5 rounded-full border border-zinc-950 shadow-md ${VIBE_COLORS[z.vibe]} ${
                        isHere
                          ? 'ring-4 ring-emerald-400/50'
                          : isSelected
                            ? 'ring-4 ring-sky-400/60'
                            : ''
                      }`}
                    />
                    <span className="mt-1 rounded bg-zinc-950/90 px-1.5 py-0.5 text-[10px] text-zinc-100 border border-zinc-800 whitespace-nowrap">
                      {z.name}
                      {isHere ? ' (TÚ)' : ''}
                      {z.clanTag ? ` [${z.clanTag}]` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Floating Legend */}
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-1.5 rounded-lg border border-zinc-800/90 bg-zinc-950/85 px-2.5 py-1.5 backdrop-blur-sm">
            {(Object.keys(VIBE_LABELS) as Array<CityLocation['vibe']>).map(
              (v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 text-[10px] text-zinc-300"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: VIBE_HEX_COLORS[v] }}
                  />
                  {VIBE_LABELS[v]}
                </span>
              ),
            )}
          </div>
        </div>

        {/* Right Side Panel: Route Details + Quick Zone List */}
        <div className="flex flex-col gap-3">
          {/* Selected Route Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/85 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">
                  {selectedZone.city}
                </div>
                <h3 className="text-base font-semibold text-zinc-100">
                  {selectedZone.name}
                </h3>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium text-zinc-950"
                style={{ backgroundColor: VIBE_HEX_COLORS[selectedZone.vibe] }}
              >
                {VIBE_LABELS[selectedZone.vibe]}
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {selectedZone.description}
            </p>

            {selectedZone.clanTag && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
                Territorio controlado por{' '}
                <span className="font-semibold">
                  [{selectedZone.clanTag}]{' '}
                  {selectedZone.clanName || 'Clan local'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-2.5 text-xs">
              <div>
                <div className="text-zinc-500">Distancia</div>
                <div className="font-medium text-zinc-100">
                  {selectedZone.id === hereId
                    ? '0 km (Aquí)'
                    : `~${routeInfo.distanceKm} km`}
                </div>
              </div>
              <div>
                <div className="text-zinc-500">Coste / Tiempo</div>
                <div className="font-medium text-zinc-100">
                  {selectedZone.id === hereId
                    ? '—'
                    : `${routeInfo.costEuros} € · ${routeInfo.durationLabel}`}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-zinc-500">Carretera</div>
                <div className="font-medium text-amber-300">
                  {routeInfo.highway}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={busy || selectedZone.id === hereId}
              onClick={() => {
                void handleTravel(selectedZone.id);
              }}
              className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {selectedZone.id === hereId
                ? 'Ya estás en esta zona'
                : busy
                  ? 'Conduciendo...'
                  : 'Viajar / Conducir'}
            </button>
          </div>

          {/* Quick Zone List */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Zonas de España ({zones.length})
            </div>
            <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
              {zones.map((z) => {
                const isHere = z.id === hereId;
                const isSelected = z.id === selectedZone.id;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => selectZone(z)}
                    className={`w-full flex items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                      isSelected
                        ? 'border-sky-500/60 bg-sky-500/10'
                        : 'border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: VIBE_HEX_COLORS[z.vibe] }}
                      />
                      <div className="truncate">
                        <span className="font-medium text-zinc-100">
                          {z.name}
                        </span>
                        <span className="ml-1.5 text-[11px] text-zinc-500">
                          {z.city}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {z.clanTag && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                          [{z.clanTag}]
                        </span>
                      )}
                      {isHere && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                          TÚ
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
