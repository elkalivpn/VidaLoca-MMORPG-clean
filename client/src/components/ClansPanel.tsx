'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface ClanMember {
  role: string;
  player?: {
    displayName?: string;
    user?: { username?: string };
  };
}

interface Clan {
  id: string;
  name: string;
  tag: string;
  level: number;
  funds: number;
  leaderId?: string;
  members?: ClanMember[];
  territories?: unknown[];
  controlledTerritories?: unknown[];
}

interface Territory {
  id: string;
  name: string;
  city: string;
  incomeRate: number;
  controller?: { id: string; name: string; tag: string } | null;
}

interface LeaderboardResponse {
  clans: Clan[];
  total: number;
  page: number;
  totalPages: number;
}

export function ClansPanel({ onChange }: { onChange?: () => void }) {
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [leaderboard, setLeaderboard] = useState<Clan[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [joinId, setJoinId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mine, board, terr] = await Promise.all([
        api.myClan() as Promise<Clan | null>,
        api.clanLeaderboard() as Promise<LeaderboardResponse>,
        api.territories() as Promise<Territory[]>,
      ]);
      setMyClan(mine);
      setLeaderboard(board?.clans || []);
      setTerritories(Array.isArray(terr) ? terr : []);
    } catch (e: any) {
      setError(e.message || 'Error cargando clanes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<void>, successMsg: string) => {
    setBusy(true);
    setError('');
    setOk('');
    try {
      await fn();
      setOk(successMsg);
      await load();
      onChange?.();
    } catch (e: any) {
      setError(e.message || 'Operación fallida');
    } finally {
      setBusy(false);
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tag.trim()) return;
    run(
      async () => {
        await api.createClan(name.trim(), tag.trim().toUpperCase().slice(0, 5));
        setName('');
        setTag('');
      },
      'Clan creado. Eres el líder.',
    );
  };

  const join = (id: string) =>
    run(async () => api.joinClan(id), 'Te has unido al clan.');

  const leave = () =>
    run(async () => api.leaveClan(), 'Has abandonado el clan.');

  const claim = (territoryId: string) =>
    run(
      async () => api.claimTerritory(territoryId),
      'Territorio reclamado (−2.500 € fondos del clan).',
    );

  if (loading) {
    return (
      <div className="card text-zinc-500 text-sm animate-pulse">Cargando clanes…</div>
    );
  }

  return (
    <div className="space-y-4">
      {(error || ok) && (
        <div
          className={`rounded-xl px-4 py-2 text-sm border ${
            error
              ? 'bg-red-950/40 border-red-900 text-red-300'
              : 'bg-emerald-950/40 border-emerald-900 text-emerald-300'
          }`}
        >
          {error || ok}
        </div>
      )}

      {/* Mi clan */}
      <div className="card">
        <h2 className="text-lg font-bold mb-3">Mi clan</h2>
        {myClan ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-black tracking-tight">
                  <span className="text-amber-500">[{myClan.tag}]</span> {myClan.name}
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  Nivel {myClan.level} · Fondos {Number(myClan.funds).toLocaleString('es-ES')} € ·{' '}
                  {myClan.members?.length || 0} miembros
                </p>
              </div>
              <button type="button" disabled={busy} onClick={leave} className="btn-secondary text-sm">
                Abandonar
              </button>
            </div>
            {myClan.members && myClan.members.length > 0 && (
              <ul className="grid sm:grid-cols-2 gap-2">
                {myClan.members.map((m, i) => (
                  <li
                    key={i}
                    className="text-sm bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 flex justify-between"
                  >
                    <span className="text-zinc-200 truncate">
                      {m.player?.displayName || m.player?.user?.username || 'Miembro'}
                    </span>
                    <span className="text-xs text-amber-600/90 uppercase tracking-wide">{m.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-zinc-500 text-sm">
              Sin clan. Crea el tuyo o únete desde el ranking. Controlar territorio cuesta 2.500 € de fondos del clan.
            </p>
            <form onSubmit={create} className="flex flex-wrap gap-2">
              <input
                className="input flex-1 min-w-[140px]"
                placeholder="Nombre del clan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
              />
              <input
                className="input w-24"
                placeholder="TAG"
                value={tag}
                onChange={(e) => setTag(e.target.value.toUpperCase())}
                maxLength={5}
              />
              <button type="submit" disabled={busy} className="btn-primary">
                Crear clan
              </button>
            </form>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="ID de clan para unirte"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !joinId.trim()}
                onClick={() => join(joinId.trim())}
                className="btn-secondary"
              >
                Unirse
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Territorios */}
      <div className="card">
        <div className="flex items-end justify-between gap-2 mb-3">
          <div>
            <h2 className="text-lg font-bold">Territorios</h2>
            <p className="text-xs text-zinc-500">Reclamar genera prestigio. Solo líder/oficial.</p>
          </div>
        </div>
        {territories.length === 0 ? (
          <p className="text-zinc-600 text-sm">No hay territorios cargados (ejecuta seed).</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {territories.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 flex flex-col gap-2"
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold text-zinc-100">{t.name}</p>
                    <p className="text-xs text-zinc-500">
                      {t.city} · +{t.incomeRate} €/ciclo
                    </p>
                  </div>
                  {t.controller ? (
                    <span className="text-[10px] h-fit px-2 py-0.5 rounded-full border border-amber-800 text-amber-400">
                      [{t.controller.tag}]
                    </span>
                  ) : (
                    <span className="text-[10px] h-fit px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-500">
                      Libre
                    </span>
                  )}
                </div>
                {myClan && (
                  <button
                    type="button"
                    disabled={busy || t.controller?.id === myClan.id}
                    onClick={() => claim(t.id)}
                    className="btn-secondary text-xs py-1.5 w-full disabled:opacity-40"
                  >
                    {t.controller?.id === myClan.id ? 'Bajo tu control' : 'Reclamar (2.500 €)'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ranking */}
      <div className="card">
        <h2 className="text-lg font-bold mb-3">Ranking de clanes</h2>
        {leaderboard.length === 0 ? (
          <p className="text-zinc-600 text-sm">Aún no hay clanes en el ranking.</p>
        ) : (
          <ul className="space-y-2">
            {leaderboard.map((c, idx) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-100 truncate">
                    <span className="text-zinc-500 mr-2">#{idx + 1}</span>
                    [{c.tag}] {c.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Nv. {c.level} · {c.members?.length || 0} miembros ·{' '}
                    {(c.controlledTerritories as unknown[])?.length ||
                      (c.territories as unknown[])?.length ||
                      0}{' '}
                    zonas
                  </p>
                </div>
                {!myClan && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => join(c.id)}
                    className="btn-secondary text-xs py-1 px-2 shrink-0"
                  >
                    Unirse
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
