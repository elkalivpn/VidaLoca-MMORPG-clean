'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { Clan } from '@/types/game';

interface ClanLeaderboardItem extends Clan {
  members?: Array<{ id: string }>;
}

interface TerritoryItem {
  id: string;
  name: string;
  city: string;
  controllerId?: string | null;
  controller?: { id: string; name: string; tag: string } | null;
}

export default function ClansPanel() {
  const { token } = useAuth();
  const [myClan, setMyClan] = useState<ClanLeaderboardItem | null>(null);
  const [clans, setClans] = useState<ClanLeaderboardItem[]>([]);
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [mine, lb, terr] = await Promise.all([
        api.myClan() as Promise<ClanLeaderboardItem | null>,
        api.clanLeaderboard() as Promise<{ clans?: ClanLeaderboardItem[] }>,
        api.territories() as Promise<TerritoryItem[]>,
      ]);
      setMyClan(mine || null);
      setClans(Array.isArray(lb?.clans) ? lb.clans : []);
      setTerritories(Array.isArray(terr) ? terr : []);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!token || !name.trim() || !tag.trim()) return;
    try {
      await api.createClan(name.trim(), tag.trim().toUpperCase());
      setMsg('Clan creado');
      setName('');
      setTag('');
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function join(clanId: string) {
    if (!token) return;
    try {
      await api.joinClan(clanId);
      setMsg('Te uniste al clan');
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function leave() {
    if (!token) return;
    try {
      await api.leaveClan();
      setMsg('Saliste del clan');
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function claim(territoryId: string) {
    if (!token) return;
    try {
      await api.claimTerritory(territoryId);
      setMsg('Territorio reclamado');
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-amber-400">Clanes</h2>
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}

      {myClan ? (
        <div className="rounded-lg border border-amber-500/30 bg-zinc-900/60 p-3 text-sm flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-amber-300">
              [{myClan.tag}] {myClan.name}
            </div>
            <div className="text-xs text-zinc-400">
              Nivel {myClan.level} · Fondos{' '}
              {myClan.funds.toLocaleString('es-ES')} € · Miembros{' '}
              {myClan.members?.length ?? 0}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void leave();
            }}
            className="text-xs text-red-400 underline hover:text-red-300"
          >
            Salir
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            className="flex-1 min-w-[160px] rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            placeholder="Nombre del clan"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm uppercase"
            placeholder="TAG"
            maxLength={5}
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              void create();
            }}
            className="rounded bg-amber-500/20 px-3 py-1 text-sm text-amber-300"
          >
            Crear
          </button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">
          Ranking de clanes
        </h3>
        <ul className="space-y-2">
          {clans.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm flex items-center justify-between gap-2"
            >
              <div>
                <div className="font-medium">
                  [{c.tag}] {c.name}
                </div>
                <div className="text-xs text-zinc-500">
                  Nv. {c.level} · Miembros: {c.members?.length ?? 0}
                </div>
              </div>
              {!myClan && (
                <button
                  type="button"
                  onClick={() => {
                    void join(c.id);
                  }}
                  className="text-xs text-amber-400 underline"
                >
                  Unirse
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {territories.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">
            Territorios
          </h3>
          <ul className="space-y-2">
            {territories.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-zinc-500">
                    {t.city} · Controla:{' '}
                    {t.controller
                      ? `[${t.controller.tag}] ${t.controller.name}`
                      : 'Libre'}
                  </div>
                </div>
                {myClan && t.controller?.id !== myClan.id && (
                  <button
                    type="button"
                    className="text-xs text-amber-400 underline"
                    onClick={() => {
                      void claim(t.id);
                    }}
                  >
                    Reclamar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
