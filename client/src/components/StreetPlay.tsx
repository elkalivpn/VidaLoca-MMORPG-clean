'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CITIES } from '@/data/cities';
import { useAuthStore } from '@/store/auth';

type Action = {
  id: string;
  label: string;
  description: string;
  lifestyle: string;
  minLevel: number;
  risk: number;
};

type StreetState = {
  player: {
    displayName?: string;
    level: number;
    xp: number;
    euros: number;
    reputation: number;
    heat: number;
    lifestyle: string;
    locationId: string;
  };
  zone: { locationId: string; vibe: string; actions: Action[] };
  activeMissions: Array<{
    id: string;
    progress: number;
    status: string;
    template?: { title: string; description: string; rewardEuros: number };
  }>;
};

const VIBE_LABEL: Record<string, string> = {
  business: 'Negocios',
  nightlife: 'Noche',
  luxury: 'Lujo',
  street: 'Calle',
};

const LIFE_LABEL: Record<string, string> = {
  LEGAL: 'Legal',
  GREY: 'Gris',
  STREET: 'Calle',
};

export default function StreetPlay({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const refreshPlayer = useAuthStore((s) => s.refreshPlayer);
  const [state, setState] = useState<StreetState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = (await api.worldStreet()) as StreetState;
      setState(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la calle');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (actionId: string) => {
    setBusy(true);
    setError('');
    try {
      const res = (await api.worldAction(actionId)) as { narrative?: string };
      setLog((prev) => [res.narrative || 'Movida hecha.', ...prev].slice(0, 12));
      await load();
      await refreshPlayer();
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'La movida falló');
    } finally {
      setBusy(false);
    }
  };

  const setLife = async (lifestyle: string) => {
    setBusy(true);
    try {
      await api.setLifestyle(lifestyle);
      await load();
      await refreshPlayer();
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !state) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-500 animate-pulse">
        Saliendo a la calle…
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-xl border border-red-900/40 bg-zinc-900/60 p-6 text-red-400">
        {error || 'Sin datos de mundo'}
      </div>
    );
  }

  const { player, zone, activeMissions } = state;
  const city = CITIES.find((c) => c.id === player.locationId);
  const heatColor =
    player.heat >= 70
      ? 'text-red-400'
      : player.heat >= 40
        ? 'text-amber-400'
        : 'text-emerald-400';

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-zinc-900/80 p-5">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-transparent to-zinc-950 pointer-events-none" />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-600/90 mb-1">
            Estás en la calle · {VIBE_LABEL[zone.vibe] || zone.vibe}
          </p>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">
            {city?.name || player.locationId}
          </h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-xl">
            {city?.description ||
              'El barrio respira. Tú decides el siguiente movimiento.'}
          </p>

          <div className="flex flex-wrap gap-3 mt-4 text-xs">
            <span className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800">
              Nv. {player.level}
            </span>
            <span className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800">
              {Math.floor(player.euros).toLocaleString('es-ES')} €
            </span>
            <span className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800">
              Rep {player.reputation}
            </span>
            <span
              className={`px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 ${heatColor}`}
            >
              Calor {player.heat}/100
            </span>
            <span className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800">
              Camino: {LIFE_LABEL[player.lifestyle] || player.lifestyle}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {(['LEGAL', 'GREY', 'STREET'] as const).map((l) => (
              <button
                key={l}
                type="button"
                disabled={busy || player.lifestyle === l}
                onClick={() => setLife(l)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  player.lifestyle === l
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                {LIFE_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Movidas del barrio</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {(zone.actions || []).map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={busy || player.level < a.minLevel}
              onClick={() => act(a.id)}
              className="text-left rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 hover:border-amber-500/40 disabled:opacity-40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-100">{a.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                  {LIFE_LABEL[a.lifestyle] || a.lifestyle}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">{a.description}</p>
              <p className="text-[10px] text-zinc-600 mt-2">
                Riesgo {Math.round(a.risk * 100)}%
                {player.level < a.minLevel ? ` · nv.${a.minLevel}` : ''}
              </p>
            </button>
          ))}
        </div>
      </div>

      {activeMissions?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">Encargos activos</h3>
          <ul className="space-y-1 text-sm">
            {activeMissions.map((m) => (
              <li key={m.id} className="text-zinc-400">
                {m.template?.title || 'Encargo'} · {m.progress}%
              </li>
            ))}
          </ul>
        </div>
      )}

      {log.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 space-y-1">
          {log.map((line, i) => (
            <p key={i} className="text-xs text-zinc-400">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
