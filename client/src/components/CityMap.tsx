'use client';

import { useState } from 'react';
import { CITIES, VIBE_COLORS, VIBE_LABELS } from '@/data/cities';
import type { CityLocation } from '@/types/game';
import { api } from '@/lib/api';

interface Props {
  currentLocationId: string | null;
  onTravel: (locationId: string) => void;
  /** Optional realtime zone join (WebSocket) */
  onRealtimeJoin?: (locationId: string) => Promise<unknown>;
}

export function CityMap({ currentLocationId, onTravel, onRealtimeJoin }: Props) {
  const [selected, setSelected] = useState<CityLocation | null>(null);
  const [traveling, setTraveling] = useState(false);
  const [error, setError] = useState('');

  const handleTravel = async () => {
    if (!selected) return;
    setTraveling(true);
    setError('');
    try {
      // REST update
      await api.updateLocation(selected.id);
      // WebSocket zone switch (presence + events)
      if (onRealtimeJoin) {
        await onRealtimeJoin(selected.id);
      }
      onTravel(selected.id);
    } catch (e: any) {
      setError(e.message || 'No se pudo viajar');
    } finally {
      setTraveling(false);
    }
  };

  const isHere = (loc: CityLocation) =>
    currentLocationId === loc.id ||
    currentLocationId === loc.name ||
    (currentLocationId || '').toLowerCase().includes(loc.id.split('_')[0]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Mapa de España</h2>
        <p className="text-zinc-500 text-sm">Clic en un barrio · viaje en tiempo real</p>
      </div>

      <div className="relative w-full h-[380px] md:h-[460px] rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-zinc-800 overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-[15%] left-[35%] w-[40%] h-[55%] rounded-[40%] border border-zinc-600" />
        </div>

        {CITIES.map((loc) => {
          const current = isHere(loc);
          const isSelected = selected?.id === loc.id;
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => setSelected(loc)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 group z-10 transition-all duration-200 ${
                isSelected ? 'scale-125 z-20' : 'hover:scale-110'
              }`}
              style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
              title={loc.name}
            >
              <span
                className={`block w-3.5 h-3.5 rounded-full shadow-lg ${VIBE_COLORS[loc.vibe]} ${
                  current ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950' : ''
                }`}
              />
              <span className="absolute left-1/2 -translate-x-1/2 top-5 whitespace-nowrap text-[10px] md:text-xs font-medium text-zinc-300 opacity-0 group-hover:opacity-100 transition bg-zinc-900/90 px-1.5 py-0.5 rounded">
                {loc.name}
              </span>
            </button>
          );
        })}

        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
          {(Object.keys(VIBE_LABELS) as CityLocation['vibe'][]).map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-900/80 px-2 py-1 rounded"
            >
              <span className={`w-2 h-2 rounded-full ${VIBE_COLORS[v]}`} />
              {VIBE_LABELS[v]}
            </span>
          ))}
        </div>
      </div>

      {selected && (
        <div className="mt-4 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">
                {selected.city} · {VIBE_LABELS[selected.vibe]}
              </p>
              <h3 className="text-lg font-bold text-white mt-0.5">{selected.name}</h3>
              <p className="text-zinc-400 text-sm mt-1">{selected.description}</p>
            </div>
            <button
              type="button"
              onClick={handleTravel}
              disabled={traveling || isHere(selected)}
              className="btn-primary shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {traveling
                ? 'Viajando...'
                : isHere(selected)
                  ? 'Estás aquí'
                  : 'Viajar'}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
