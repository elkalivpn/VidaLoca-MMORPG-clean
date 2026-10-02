'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function ClansPanel() {
  const { token } = useAuth();
  const [clans, setClans] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    if (!token) return;
    try {
      const data = await api.get('/clans', token);
      setClans(Array.isArray(data) ? data : data.clans || []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function create() {
    if (!token || !name.trim()) return;
    try {
      await api.post('/clans', { name: name.trim() }, token);
      setMsg('Clan creado');
      setName('');
      load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function claim(territoryId: string) {
    if (!token) return;
    try {
      await api.post(`/clans/territories/${territoryId}/claim`, {}, token);
      setMsg('Territorio reclamado');
      load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-amber-400">Clanes</h2>
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          placeholder="Nombre del clan"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" onClick={create} className="rounded bg-amber-500/20 px-3 text-sm text-amber-300">
          Crear
        </button>
      </div>
      <ul className="space-y-2">
        {clans.map((c) => (
          <li key={c.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
            <div className="font-medium">{c.name}</div>
            <div className="text-xs text-zinc-500">Miembros: {c.memberCount ?? '—'}</div>
            {c.territoryId && (
              <button
                type="button"
                className="mt-2 text-xs text-amber-400 underline"
                onClick={() => claim(c.territoryId)}
              >
                Reclamar territorio
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
