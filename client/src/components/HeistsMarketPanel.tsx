'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { CITIES } from '@/data/cities';
import { useAuth } from '@/store/auth';
import type {
  HeistLobby,
  HeistRole,
  HeistTemplate,
  MarketItem,
} from '@/types/game';

const HEIST_ROLES: { id: HeistRole; label: string; icon: string }[] = [
  { id: 'Conductor', label: 'Conductor', icon: '🚗' },
  { id: 'Hacker', label: 'Hacker', icon: '💻' },
  { id: 'Asalto', label: 'Asalto', icon: '🔫' },
];

const QUICK_QUANTITIES = [1, 5, 10] as const;

export default function HeistsMarketPanel() {
  const { token, player, refreshPlayer } = useAuth();
  const [templates, setTemplates] = useState<HeistTemplate[]>([]);
  const [lobbies, setLobbies] = useState<HeistLobby[]>([]);
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [marketCity, setMarketCity] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, HeistRole>>(
    {},
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);

  const currentCity = useMemo(() => {
    const loc = CITIES.find((c) => c.id === player?.locationId);
    return loc ? `${loc.name} (${loc.city})` : player?.locationId || 'España';
  }, [player?.locationId]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    try {
      const [heistsRes, marketRes] = await Promise.all([
        api.heists().catch(() => null),
        api.worldMarket().catch(() => null),
      ]);

      if (heistsRes && typeof heistsRes === 'object') {
        const list = Array.isArray(heistsRes.templates)
          ? heistsRes.templates
          : Array.isArray(heistsRes.catalog)
            ? heistsRes.catalog
            : [];
        setTemplates(list);
        setLobbies(Array.isArray(heistsRes.lobbies) ? heistsRes.lobbies : []);
      } else {
        setTemplates([]);
        setLobbies([]);
      }

      if (Array.isArray(marketRes)) {
        setMarketItems(marketRes);
        setMarketCity(null);
      } else if (marketRes && typeof marketRes === 'object') {
        setMarketItems(Array.isArray(marketRes.items) ? marketRes.items : []);
        setMarketCity(marketRes.city || marketRes.locationId || null);
      } else {
        setMarketItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleCreateHeist(templateId: string) {
    if (!token) return;
    setBusy(`create:${templateId}`);
    setFeedback(null);
    try {
      await api.createHeist(templateId);
      setFeedback({
        text: `Lobby creado en ${currentCity}. Elige rol o espera a tu banda.`,
        ok: true,
      });
      await Promise.all([loadAll(), refreshPlayer()]);
    } catch (e: unknown) {
      setFeedback({
        text:
          e instanceof Error
            ? e.message
            : 'No se pudo crear el lobby del golpe',
        ok: false,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleJoinHeist(lobbyId: string) {
    if (!token) return;
    const role: HeistRole = selectedRoles[lobbyId] || 'Asalto';
    setBusy(`join:${lobbyId}`);
    setFeedback(null);
    try {
      await api.joinHeist(lobbyId, role);
      setFeedback({
        text: `Te has unido al golpe como ${role}.`,
        ok: true,
      });
      await Promise.all([loadAll(), refreshPlayer()]);
    } catch (e: unknown) {
      setFeedback({
        text: e instanceof Error ? e.message : 'No se pudo unir al golpe',
        ok: false,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleExecuteHeist(lobbyId: string) {
    if (!token) return;
    setBusy(`exec:${lobbyId}`);
    setFeedback(null);
    try {
      const res = await api.executeHeist(lobbyId);
      const parts: string[] = [];
      if (typeof res?.rewardEuros === 'number' && res.rewardEuros > 0) {
        parts.push(`+${res.rewardEuros.toLocaleString('es-ES')} €`);
      }
      if (
        typeof res?.rewardDirtyEuros === 'number' &&
        res.rewardDirtyEuros > 0
      ) {
        parts.push(`+${res.rewardDirtyEuros.toLocaleString('es-ES')} € sucios`);
      }
      if (typeof res?.rewardXp === 'number' && res.rewardXp > 0) {
        parts.push(`+${res.rewardXp} XP`);
      }
      if (typeof res?.heatDelta === 'number' && res.heatDelta !== 0) {
        parts.push(`${res.heatDelta > 0 ? '+' : ''}${res.heatDelta} calor`);
      }
      const base =
        res?.message ||
        (res?.success === false
          ? 'El golpe ha salido mal.'
          : '¡Golpe ejecutado con éxito!');
      setFeedback({
        text: parts.length > 0 ? `${base} (${parts.join(' · ')})` : base,
        ok: res?.success !== false,
      });
      await Promise.all([loadAll(), refreshPlayer()]);
    } catch (e: unknown) {
      setFeedback({
        text: e instanceof Error ? e.message : 'Error al ejecutar el golpe',
        ok: false,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleTrade(
    item: MarketItem,
    action: 'BUY' | 'SELL',
    qtyOverride?: number,
  ) {
    if (!token) return;
    const qty = qtyOverride ?? quantities[item.id] ?? 1;
    if (qty <= 0) return;
    setBusy(`trade:${item.id}:${action}`);
    setFeedback(null);
    try {
      const res = await api.tradeMarket(item.id, action, qty);
      const defaultMsg =
        action === 'BUY'
          ? `Compraste ${qty}× ${item.name}.`
          : `Vendiste ${qty}× ${item.name}.`;
      setFeedback({
        text: res?.message || defaultMsg,
        ok: true,
      });
      await Promise.all([loadAll(), refreshPlayer()]);
    } catch (e: unknown) {
      setFeedback({
        text:
          e instanceof Error
            ? e.message
            : 'No se pudo completar la operación en el mercado',
        ok: false,
      });
    } finally {
      setBusy(null);
    }
  }

  function resolveLocationLabel(locationId?: string | null): string {
    if (!locationId) return currentCity;
    const loc = CITIES.find((c) => c.id === locationId);
    return loc ? `${loc.name} (${loc.city})` : locationId;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-400">
            Golpes Cooperativos &amp; Mercado Regional
          </h2>
          <p className="text-xs text-zinc-400">
            Ubicación actual:{' '}
            <span className="text-zinc-200 font-medium">{currentCity}</span>
            {' · '}
            Efectivo:{' '}
            <span className="text-emerald-400 font-medium">
              {(player?.euros ?? 0).toLocaleString('es-ES')} €
            </span>
            {typeof player?.dirtyEuros === 'number' &&
              player.dirtyEuros > 0 && (
                <>
                  {' · '}
                  Dinero sucio:{' '}
                  <span className="text-red-400 font-medium">
                    {player.dirtyEuros.toLocaleString('es-ES')} €
                  </span>
                </>
              )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadAll();
          }}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-amber-500/40 hover:text-amber-300"
        >
          Actualizar en vivo
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            feedback.ok
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Sección 1: Golpes Cooperativos */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
            🎯 Golpes Cooperativos
          </h3>
          <span className="text-xs text-zinc-500">
            Roles: Conductor · Hacker · Asalto
          </span>
        </div>

        {/* Lobbies activos */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-zinc-400">
            Lobbies activos ({lobbies.length})
          </h4>
          {loading ? (
            <p className="text-xs text-zinc-500">Cargando golpes…</p>
          ) : lobbies.length === 0 ? (
            <p className="text-xs text-zinc-500 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
              No hay lobbies activos ahora mismo. Crea uno desde el catálogo en{' '}
              {currentCity}.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lobbies.map((lobby) => {
                const isMember = lobby.members?.some(
                  (m) => m.playerId === player?.id,
                );
                const isLeader = lobby.leaderId === player?.id;
                const selectedRole = selectedRoles[lobby.id] || 'Asalto';
                const title =
                  lobby.templateName ||
                  lobby.template?.name ||
                  lobby.templateId;
                return (
                  <div
                    key={lobby.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2.5 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-zinc-100">
                          {title}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {resolveLocationLabel(lobby.locationId)} · Líder:{' '}
                          {lobby.leaderName || 'Anónimo'}
                        </div>
                      </div>
                      <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        {lobby.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(lobby.members || []).map((m) => (
                        <span
                          key={`${lobby.id}-${m.playerId}`}
                          className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-xs text-zinc-200"
                        >
                          <span className="text-amber-300">{m.role}</span>
                          <span className="text-zinc-400">·</span>
                          <span>{m.displayName || m.playerId.slice(0, 6)}</span>
                        </span>
                      ))}
                      {lobby.maxPlayers && (
                        <span className="text-xs text-zinc-500 self-center">
                          ({lobby.members?.length ?? 0}/{lobby.maxPlayers})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {!isMember && (
                        <>
                          <select
                            aria-label="Seleccionar rol"
                            value={selectedRole}
                            onChange={(e) =>
                              setSelectedRoles((prev) => ({
                                ...prev,
                                [lobby.id]: e.target.value as HeistRole,
                              }))
                            }
                            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                          >
                            {HEIST_ROLES.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.icon} {r.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={busy === `join:${lobby.id}`}
                            onClick={() => {
                              void handleJoinHeist(lobby.id);
                            }}
                            className="rounded border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-500/25 disabled:opacity-50"
                          >
                            {busy === `join:${lobby.id}`
                              ? 'Uniéndose…'
                              : 'Unirse'}
                          </button>
                        </>
                      )}

                      {(isLeader || isMember) && (
                        <button
                          type="button"
                          disabled={busy === `exec:${lobby.id}`}
                          onClick={() => {
                            void handleExecuteHeist(lobby.id);
                          }}
                          className="rounded border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          {busy === `exec:${lobby.id}`
                            ? 'Ejecutando…'
                            : 'Ejecutar Golpe'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Catálogo de golpes */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-zinc-400">
            Catálogo de golpes ({templates.length})
          </h4>
          {templates.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No hay plantillas de golpes disponibles.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 flex flex-col justify-between gap-2 text-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-100">
                        {tpl.name}
                      </span>
                      {tpl.difficulty && (
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                          {tpl.difficulty}
                        </span>
                      )}
                    </div>
                    {tpl.description && (
                      <p className="text-xs text-zinc-400">{tpl.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400 pt-1">
                      {typeof tpl.rewardEuros === 'number' && (
                        <span className="text-emerald-400">
                          Botín: {tpl.rewardEuros.toLocaleString('es-ES')} €
                        </span>
                      )}
                      {typeof tpl.rewardDirtyEuros === 'number' &&
                        tpl.rewardDirtyEuros > 0 && (
                          <span className="text-red-400">
                            +{tpl.rewardDirtyEuros.toLocaleString('es-ES')} €
                            sucios
                          </span>
                        )}
                      {typeof tpl.rewardXp === 'number' && (
                        <span className="text-sky-400">+{tpl.rewardXp} XP</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={busy === `create:${tpl.id}`}
                    onClick={() => {
                      void handleCreateHeist(tpl.id);
                    }}
                    className="w-full rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                  >
                    {busy === `create:${tpl.id}`
                      ? 'Creando lobby…'
                      : `Crear lobby en ${currentCity}`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Sección 2: Mercado Regional de España */}
      <section className="space-y-3 border-t border-zinc-800 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
            📈 Mercado Regional de España
          </h3>
          <span className="text-xs text-zinc-400">
            Precios locales en:{' '}
            <span className="text-amber-300 font-medium">
              {marketCity ? resolveLocationLabel(marketCity) : currentCity}
            </span>
          </span>
        </div>

        {marketItems.length === 0 ? (
          <p className="text-xs text-zinc-500 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            No hay mercancías disponibles en el mercado de esta ciudad.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase">
                <tr>
                  <th className="px-3 py-2">Mercancía</th>
                  <th className="px-3 py-2">Compra</th>
                  <th className="px-3 py-2">Venta</th>
                  <th className="px-3 py-2">Tendencia</th>
                  <th className="px-3 py-2">Stock / Tuyo</th>
                  <th className="px-3 py-2 text-right">Operar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {marketItems.map((item) => {
                  const buyPrice = item.buyPrice ?? item.price ?? 0;
                  const sellPrice = item.sellPrice ?? item.price ?? 0;
                  const qty = quantities[item.id] ?? 1;
                  const isBuying = busy === `trade:${item.id}:BUY`;
                  const isSelling = busy === `trade:${item.id}:SELL`;
                  return (
                    <tr key={item.id} className="hover:bg-zinc-900/60">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-zinc-100 flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {item.illegal && (
                            <span className="rounded bg-red-500/15 border border-red-500/30 px-1 py-0.2 text-[10px] text-red-300">
                              Ilegal
                            </span>
                          )}
                        </div>
                        {item.category && (
                          <div className="text-[11px] text-zinc-500">
                            {item.category}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-emerald-400">
                        {buyPrice.toLocaleString('es-ES')} €
                      </td>
                      <td className="px-3 py-2.5 font-medium text-amber-300">
                        {sellPrice.toLocaleString('es-ES')} €
                      </td>
                      <td className="px-3 py-2.5">
                        {item.trend === 'UP' ? (
                          <span className="text-emerald-400">
                            ▲{' '}
                            {typeof item.deltaPercent === 'number'
                              ? `+${item.deltaPercent}%`
                              : 'Alza'}
                          </span>
                        ) : item.trend === 'DOWN' ? (
                          <span className="text-red-400">
                            ▼{' '}
                            {typeof item.deltaPercent === 'number'
                              ? `${item.deltaPercent}%`
                              : 'Baja'}
                          </span>
                        ) : (
                          <span className="text-zinc-400">● Estable</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-300">
                        <span>{item.stock ?? '∞'}</span>
                        {' / '}
                        <span className="text-sky-300">{item.owned ?? 0}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {QUICK_QUANTITIES.map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() =>
                                setQuantities((prev) => ({
                                  ...prev,
                                  [item.id]: q,
                                }))
                              }
                              className={`rounded px-1.5 py-0.5 text-[11px] border ${
                                qty === q
                                  ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                                  : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              ×{q}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={isBuying || isSelling}
                            onClick={() => {
                              void handleTrade(item, 'BUY');
                            }}
                            className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                          >
                            {isBuying ? '…' : `Comprar (${qty})`}
                          </button>
                          <button
                            type="button"
                            disabled={isBuying || isSelling}
                            onClick={() => {
                              void handleTrade(item, 'SELL');
                            }}
                            className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                          >
                            {isSelling ? '…' : `Vender (${qty})`}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
