'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { playCoinSfx } from '@/lib/sfx';
import type { Clan } from '@/types/game';

interface ClanLeaderboardItem extends Clan {
  members?: Array<{ id: string }>;
}

interface TerritoryItem {
  id: string;
  name: string;
  city: string;
  incomeRate?: number;
  controllerId?: string | null;
  controller?: { id: string; name: string; tag: string } | null;
}

export default function ClansPanel() {
  const { token, refreshPlayer } = useAuth();
  const [myClan, setMyClan] = useState<ClanLeaderboardItem | null>(null);
  const [clans, setClans] = useState<ClanLeaderboardItem[]>([]);
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [donateAmount, setDonateAmount] = useState('500');
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
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function join(clanId: string) {
    if (!token) return;
    try {
      await api.joinClan(clanId);
      setMsg('Te uniste al clan');
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function leave() {
    if (!token) return;
    try {
      await api.leaveClan();
      setMsg('Saliste del clan');
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function donate() {
    if (!token) return;
    const amount = Number(donateAmount);
    if (!Number.isFinite(amount) || amount < 50) {
      setMsg('Introduce un aporte mínimo de 50 €');
      return;
    }
    try {
      const res = await api.donateToClan(amount);
      playCoinSfx();
      setMsg(
        `Aportaste ${res.donated.toLocaleString('es-ES')} € al clan (Fondos: ${res.clanFunds.toLocaleString('es-ES')} €)`,
      );
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function claim(territoryId: string) {
    if (!token) return;
    try {
      await api.claimTerritory(territoryId);
      playCoinSfx();
      setMsg('Territorio conquistado (escudo de protección de 2h activo)');
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function collectTax(territoryId: string) {
    if (!token) return;
    try {
      const res = await api.collectClanTerritoryTax(territoryId);
      playCoinSfx();
      setMsg(
        `Recaudados ${res.taxAmount.toLocaleString('es-ES')} € en ${res.territoryName} (+50 XP de clan)`,
      );
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-amber-400">
        Clanes &amp; Guerra Territorial
      </h2>
      {msg && (
        <p className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {msg}
        </p>
      )}

      {myClan ? (
        <div className="rounded-lg border border-amber-500/30 bg-zinc-900/60 p-4 text-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
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
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
            <input
              type="number"
              min={50}
              step={50}
              value={donateAmount}
              onChange={(e) => setDonateAmount(e.target.value)}
              className="w-28 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
              placeholder="500"
            />
            <button
              type="button"
              onClick={() => {
                void donate();
              }}
              className="rounded bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
            >
              Donar € al Clan
            </button>
            <span className="text-[11px] text-zinc-500">
              Conquistar un territorio cuesta 2.500 € de fondos del clan.
            </span>
          </div>
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
                  Nv. {c.level} · Fondos{' '}
                  {Math.round(c.funds).toLocaleString('es-ES')} € · Miembros:{' '}
                  {c.members?.length ?? 0}
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
            Territorios en Disputa (Recaudación cada 4h)
          </h3>
          <ul className="space-y-2">
            {territories.map((t) => {
              const controlledByMine = Boolean(
                myClan && t.controller?.id === myClan.id,
              );
              return (
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
                      {typeof t.incomeRate === 'number'
                        ? ` · Renta ${(t.incomeRate * 2).toLocaleString('es-ES')} €/4h`
                        : ''}
                    </div>
                  </div>
                  {myClan && controlledByMine && (
                    <button
                      type="button"
                      className="rounded bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
                      onClick={() => {
                        void collectTax(t.id);
                      }}
                    >
                      Recaudar Impuestos
                    </button>
                  )}
                  {myClan && !controlledByMine && (
                    <button
                      type="button"
                      className="rounded bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
                      onClick={() => {
                        void claim(t.id);
                      }}
                    >
                      Reclamar (2.500 €)
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
