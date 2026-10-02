'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function MissionsPanel() {
  const { token, setPlayer } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  async function load() {
    if (!token) return;
    try {
      const data = await api.get('/missions', token);
      setMissions(Array.isArray(data) ? data : data.missions || []);
    } catch {
      setMissions([]);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function claim(id: string) {
    if (!token) return;
    try {
      const data = await api.post(`/missions/${id}/claim`, {}, token);
      if (data.player) setPlayer(data.player);
      setMsg(data.message || 'Recompensa cobrada');
      load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function accept(id: string) {
    if (!token) return;
    try {
      await api.post(`/missions/${id}/accept`, {}, token);
      setMsg('Misión aceptada');
      load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-amber-400">Misiones</h2>
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}
      <ul className="space-y-2">
        {missions.map((m) => (
          <li key={m.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
            <div className="font-medium">{m.title || m.name}</div>
            <div className="text-xs text-zinc-500 mt-1">{m.description}</div>
            <div className="mt-2 flex gap-2">
              {m.status === 'AVAILABLE' && (
                <button type="button" onClick={() => accept(m.id)} className="text-xs text-amber-400 underline">
                  Aceptar
                </button>
              )}
              {m.status === 'COMPLETED' && (
                <button type="button" onClick={() => claim(m.id)} className="text-xs text-green-400 underline">
                  Cobrar
                </button>
              )}
              <span className="text-xs text-zinc-600">{m.status}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
