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
  { id: 'DRIVER', label: 'Conductor', icon: '🚗' },
  { id: 'HACKER', label: 'Hacker', icon: '💻' },
  { id: 'ENFORCER', label: 'Asalto', icon: '🔫' },
];

const ROLE_LABELS: Record<string, string> = {
  DRIVER: '🚗 Conductor',
  HACKER: '💻 Hacker',
  ENFORCER: '🔫 Asalto',
};

const QUICK_QUANTITIES = [1, 5, 10] as const;

export default function HeistsMarketPanel() {
  const { token, player, refreshPlayer } = useAuth();
  const [templates, setTemplates] = useState<HeistTemplate[]>([]);
  const [lobbies, setLobbies] = useState<HeistLobby[]>([]);
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [marketCity, setMarketCity] = useState<string | null>(null);
  const [createRole, setCreateRole] = useState<HeistRole>('DRIVER');
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
        const list = Array.isArray(heistsRes.catalog) ? heistsRes.catalog : [];
        setTemplates(list);
        setLobbies(
          Array.isArray(heistsRes.activeLobbies) ? heistsRes.activeLobbies : [],
        );
      } else {
        setTemplates([]);
        setLobbies([]);
      }

      if (Array.isArray(marketRes)) {
        setMarketItems(marketRes);
        setMarketCity(null);
      } else if (marketRes && typeof marketRes === 'object') {
        const goods = Array.isArray(marketRes.goods)
          ? marketRes.goods
          : Array.isArray(marketRes.items)
            ? marketRes.items
            : [];
        setMarketItems(goods);
        setMarketCity(
          marketRes.currentCity ||
            marketRes.currentZoneId ||
            marketRes.city ||
            marketRes.locationId ||
            null,
        );
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

  async function handleCreateHeist(heistId: string) {
    if (!token) return;
    setBusy(`create:${heistId}`);
    setFeedback(null);
    try {
      await api.createHeist(heistId, createRole);
      setFeedback({
        text: `Lobby creado en ${currentCity} como ${ROLE_LABELS[createRole] || createRole}.`,
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
    const role: HeistRole = selectedRoles[lobbyId] || 'ENFORCER';
    setBusy(`join:${lobbyId}`);
    setFeedback(null);
    try {
      await api.joinHeist(lobbyId, role);
      setFeedback({
        text: `Te has unido al golpe como ${ROLE_LABELS[role] || role}.`,
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

  async function handleLeaveHeist(lobbyId: string) {
    if (!token) return;
    setBusy(`leave:${lobbyId}`);
    setFeedback(null);
    try {
      const res = await api.leaveHeist(lobbyId);
      setFeedback({
        text:
          res?.message ||
          (res?.disbanded
            ? 'Has disuelto el lobby.'
            : 'Has salido del lobby de golpe.'),
        ok: true,
      });
      await Promise.all([loadAll(), refreshPlayer()]);
    } catch (e: unknown) {
      setFeedback({
        text: e instanceof Error ? e.message : 'No se pudo abandonar el lobby',
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
      const myReward = res?.rewards?.find((r) => r.playerId === player?.id);
      const parts: string[] = [];
      if (myReward) {
        if (myReward.eurosGained > 0) {
          parts.push(`+${myReward.eurosGained.toLocaleString('es-ES')} €`);
        }
        if (myReward.dirtyEurosGained > 0) {
          parts.push(
            `+${myReward.dirtyEurosGained.toLocaleString('es-ES')} € sucios`,
          );
        }
        if (myReward.xpGained > 0) {
          parts.push(`+${myReward.xpGained} XP`);
        }
        if (myReward.heatGained !== 0) {
          parts.push(`+${myReward.heatGained} calor`);
        }
        if ((myReward.reputationGained ?? 0) > 0) {
          parts.push(`+${myReward.reputationGained} rep`);
        }
      }
      const base =
        res?.narrative ||
        (res?.succeeded
          ? '¡Golpe ejecutado con éxito!'
          : 'El golpe ha salido mal.');
      setFeedback({
        text:
          parts.length > 0 ? `${base} (Tu parte: ${parts.join(' · ')})` : base,
        ok: Boolean(res?.succeeded),
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
      const verb = action === 'BUY' ? 'Compraste' : 'Vendiste';
      const bonusNote = res.maritimeBonusApplied
        ? ' (Bonus Portuario +15%)'
        : '';
      setFeedback({
        text:
          res?.message ||
          `${verb} ${res.quantity}× ${item.name} por ${res.totalAmount.toLocaleString('es-ES')} € en ${res.city}${bonusNote}.`,
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
            🎯 Golpes Cooperativos
          </h3>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Tu rol al crear:</span>
            <select
              aria-label="Rol al crear lobby"
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as HeistRole)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
            >
              {HEIST_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.icon} {r.label}
                </option>
              ))}
            </select>
          </div>
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
                const participants = lobby.participants || [];
                const tpl = templates.find((t) => t.id === lobby.heistId);
                const isMember = participants.some(
                  (m) => m.playerId === player?.id,
                );
                const isLeader = lobby.leaderPlayerId === player?.id;
                const leaderMember = participants.find(
                  (m) => m.playerId === lobby.leaderPlayerId,
                );
                const maxCrew = tpl?.maxCrew ?? 3;
                const minCrew = tpl?.minCrew ?? 1;
                const occupiedRoles = new Set(participants.map((p) => p.role));
                const freeRoles = HEIST_ROLES.filter(
                  (r) => !occupiedRoles.has(r.id),
                );
                const selectedRole =
                  selectedRoles[lobby.id] &&
                  !occupiedRoles.has(selectedRoles[lobby.id])
                    ? selectedRoles[lobby.id]
                    : (freeRoles[0]?.id ?? 'ENFORCER');
                const title = lobby.heistName || tpl?.name || lobby.heistId;
                const sameZone =
                  lobby.zoneId === (player?.locationId || 'madrid_centro');
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
                          {resolveLocationLabel(lobby.zoneId)} · Líder:{' '}
                          {leaderMember?.displayName || 'Anónimo'}
                        </div>
                      </div>
                      <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        {lobby.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {participants.map((m) => (
                        <span
                          key={`${lobby.id}-${m.playerId}`}
                          className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-xs text-zinc-200"
                        >
                          <span className="text-amber-300">
                            {ROLE_LABELS[m.role] || m.role}
                          </span>
                          <span className="text-zinc-400">·</span>
                          <span>{m.displayName || m.playerId.slice(0, 6)}</span>
                        </span>
                      ))}
                      <span className="text-xs text-zinc-500 self-center">
                        ({participants.length}/{maxCrew} · mín. {minCrew})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {!isMember && freeRoles.length > 0 && (
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
                            {freeRoles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.icon} {r.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!sameZone || busy === `join:${lobby.id}`}
                            title={
                              sameZone
                                ? undefined
                                : `Viaja a ${resolveLocationLabel(lobby.zoneId)} para unirte`
                            }
                            onClick={() => {
                              void handleJoinHeist(lobby.id);
                            }}
                            className="rounded border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-500/25 disabled:opacity-50"
                          >
                            {busy === `join:${lobby.id}`
                              ? 'Uniéndose…'
                              : sameZone
                                ? 'Unirse'
                                : 'Otra zona'}
                          </button>
                        </>
                      )}

                      {isMember && (
                        <>
                          <button
                            type="button"
                            disabled={
                              participants.length < minCrew ||
                              busy === `exec:${lobby.id}`
                            }
                            title={
                              participants.length < minCrew
                                ? `Se necesitan al menos ${minCrew} jugadores`
                                : undefined
                            }
                            onClick={() => {
                              void handleExecuteHeist(lobby.id);
                            }}
                            className="rounded border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                          >
                            {busy === `exec:${lobby.id}`
                              ? 'Ejecutando…'
                              : 'Ejecutar Golpe'}
                          </button>
                          <button
                            type="button"
                            disabled={busy === `leave:${lobby.id}`}
                            onClick={() => {
                              void handleLeaveHeist(lobby.id);
                            }}
                            className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                          >
                            {busy === `leave:${lobby.id}`
                              ? 'Saliendo…'
                              : isLeader
                                ? 'Disolver'
                                : 'Salir'}
                          </button>
                        </>
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
              {templates.map((tpl) => {
                const levelOk = (player?.level ?? 1) >= (tpl.minLevel ?? 1);
                return (
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
                        <p className="text-xs text-zinc-400">
                          {tpl.description}
                        </p>
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
                          <span className="text-sky-400">
                            +{tpl.rewardXp} XP
                          </span>
                        )}
                        {typeof tpl.minLevel === 'number' && (
                          <span
                            className={
                              levelOk ? 'text-zinc-400' : 'text-red-300'
                            }
                          >
                            Nv.{tpl.minLevel}+ · {tpl.minCrew ?? 1}-
                            {tpl.maxCrew ?? 3} jug.
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!levelOk || busy === `create:${tpl.id}`}
                      onClick={() => {
                        void handleCreateHeist(tpl.id);
                      }}
                      className="w-full rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      {!levelOk
                        ? `Requiere Nivel ${tpl.minLevel}`
                        : busy === `create:${tpl.id}`
                          ? 'Creando lobby…'
                          : `Crear lobby en ${currentCity}`}
                    </button>
                  </div>
                );
              })}
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
                  <th className="px-3 py-2">Precio Local</th>
                  <th className="px-3 py-2">Vs. Base</th>
                  <th className="px-3 py-2">Mejor Destino</th>
                  <th className="px-3 py-2">Tuyo</th>
                  <th className="px-3 py-2 text-right">Operar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {marketItems.map((item) => {
                  const localPrice =
                    item.currentPrice ?? item.buyPrice ?? item.price ?? 0;
                  const basePrice = item.basePrice || localPrice || 1;
                  const deltaPercent = Math.round(
                    ((localPrice - basePrice) / basePrice) * 100,
                  );
                  let bestCity: string | null = null;
                  let bestCityPrice = localPrice;
                  if (item.cityPrices) {
                    for (const [cName, cPrice] of Object.entries(
                      item.cityPrices,
                    )) {
                      if (cPrice > bestCityPrice) {
                        bestCityPrice = cPrice;
                        bestCity = cName;
                      }
                    }
                  }
                  const qty = quantities[item.id] ?? 1;
                  const isBuying = busy === `trade:${item.id}:BUY`;
                  const isSelling = busy === `trade:${item.id}:SELL`;
                  const owned = item.owned ?? 0;
                  return (
                    <tr key={item.id} className="hover:bg-zinc-900/60">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-zinc-100">
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="text-[11px] text-zinc-500 max-w-xs">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-emerald-400">
                        {localPrice.toLocaleString('es-ES')} €
                      </td>
                      <td className="px-3 py-2.5">
                        {deltaPercent > 2 ? (
                          <span className="text-amber-300">
                            ▲ +{deltaPercent}% (Caro)
                          </span>
                        ) : deltaPercent < -2 ? (
                          <span className="text-emerald-400">
                            ▼ {deltaPercent}% (Ganga)
                          </span>
                        ) : (
                          <span className="text-zinc-400">
                            ●{' '}
                            {deltaPercent >= 0
                              ? `+${deltaPercent}%`
                              : `${deltaPercent}%`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-300">
                        {bestCity ? (
                          <span>
                            {bestCity}{' '}
                            <span className="text-amber-300 font-medium">
                              ({bestCityPrice.toLocaleString('es-ES')} €)
                            </span>
                          </span>
                        ) : (
                          <span className="text-emerald-400">
                            Mejor plaza aquí
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-sky-300 font-semibold">
                        {owned}
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
                            disabled={isBuying || isSelling || owned < qty}
                            onClick={() => {
                              void handleTrade(item, 'SELL');
                            }}
                            className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-40"
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
