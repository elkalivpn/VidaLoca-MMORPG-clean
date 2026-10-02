'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { CITIES } from '@/data/cities';

export default function CityMap() {
  const { token, player, refreshPlayer } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const here = player?.locationId;

  async function travel(zoneId: string) {
    if (!token) return;
    setBusy(true);
    setMsg('');
    try {
      await api.updateLocation(zoneId);
      await refreshPlayer();
      setMsg(`Viajaste a ${zoneId}`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-amber-400">Mapa</h2>
      <p className="text-sm text-zinc-400">
        Zona actual: <span className="text-zinc-200">{here || '—'}</span>
      </p>
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CITIES.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={busy || here === c.id}
            onClick={() => travel(c.id)}
            className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-4 text-left hover:border-amber-500/50 disabled:opacity-50"
          >
            <div className="font-medium text-zinc-100">{c.name}</div>
            <div className="text-xs text-zinc-500 mt-1">{c.city}</div>
            <div className="text-xs text-zinc-600 mt-2">{c.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
