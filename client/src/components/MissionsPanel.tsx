'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { MissionMode, MissionTemplate, PlayerMission } from '@/types/game';

type MissionTab = MissionMode | 'MY';

const MODE_LABELS: Record<MissionMode, string> = {
  STORY: 'Historia (Opcional)',
  ONLINE_SOLO: 'Online Individual',
  ONLINE_COOP: 'Online con Amigos',
};

const DIFFICULTY_BADGE: Record<MissionTemplate['difficulty'], string> = {
  EASY: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  MEDIUM: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  HARD: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  SUICIDE: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const STEP_COOLDOWN_SEC: Record<MissionTemplate['difficulty'], number> = {
  EASY: 8,
  MEDIUM: 12,
  HARD: 18,
  SUICIDE: 25,
};

export default function MissionsPanel() {
  const { token, player, refreshPlayer } = useAuth();
  const [tab, setTab] = useState<MissionTab>('STORY');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [myMissions, setMyMissions] = useState<PlayerMission[]>([]);
  const [openSquads, setOpenSquads] = useState<PlayerMission[]>([]);
  const [squadCodeInput, setSquadCodeInput] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [tpls, mine, coop] = await Promise.all([
        api.missionTemplates() as Promise<MissionTemplate[]>,
        api.myMissions() as Promise<PlayerMission[]>,
        api.openCoopSquads().catch(() => []) as Promise<PlayerMission[]>,
      ]);
      setTemplates(Array.isArray(tpls) ? tpls : []);
      setMyMissions(Array.isArray(mine) ? mine : []);
      setOpenSquads(Array.isArray(coop) ? coop : []);
    } catch {
      setTemplates([]);
      setMyMissions([]);
      setOpenSquads([]);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActiveCooldown = useMemo(
    () =>
      myMissions.some(
        (m) => m.status === 'IN_PROGRESS' && Boolean(m.lastStepAt),
      ),
    [myMissions],
  );

  useEffect(() => {
    if (!hasActiveCooldown) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasActiveCooldown]);

  async function runAction(
    busyKey: string,
    fn: () => Promise<unknown>,
    successMessage: string,
    refreshStats = false,
  ) {
    if (!token) return;
    setBusy(busyKey);
    setMsg('');
    setErrMsg('');
    try {
      await fn();
      setNowMs(Date.now());
      setMsg(successMessage);
      if (refreshStats) {
        await Promise.all([load(), refreshPlayer()]);
      } else {
        await load();
      }
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Error en operación');
    } finally {
      setBusy(null);
    }
  }

  const activeTemplateIds = useMemo(
    () =>
      new Set(
        myMissions
          .filter((m) => m.status === 'PENDING' || m.status === 'IN_PROGRESS')
          .map((m) => m.template.id),
      ),
    [myMissions],
  );

  const skippedTemplateIds = useMemo(
    () =>
      new Set(
        myMissions
          .filter((m) => m.status === 'SKIPPED')
          .map((m) => m.template.id),
      ),
    [myMissions],
  );

  const completedUniqueTemplateIds = useMemo(
    () =>
      new Set(
        myMissions
          .filter(
            (m) =>
              (m.status === 'CLAIMED' || m.status === 'COMPLETED') &&
              !m.template.isRepeatable,
          )
          .map((m) => m.template.id),
      ),
    [myMissions],
  );

  const cooldownHoursByTemplateId = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of myMissions) {
      if (
        m.status === 'CLAIMED' &&
        m.template.isRepeatable &&
        (m.template.cooldownHours ?? 0) > 0 &&
        m.completedAt
      ) {
        const readyAt =
          new Date(m.completedAt).getTime() +
          (m.template.cooldownHours ?? 0) * 3600_000;
        if (readyAt > nowMs) {
          map.set(m.template.id, Math.ceil((readyAt - nowMs) / 3600_000));
        }
      }
    }
    return map;
  }, [myMissions, nowMs]);

  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    templates.forEach((t) => {
      if (t.city) cities.add(t.city);
    });
    return Array.from(cities).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (tab === 'MY') return [];
    return templates.filter((t) => {
      const tMode = t.mode ?? 'ONLINE_SOLO';
      if (tMode !== tab) return false;
      if (cityFilter !== 'ALL' && t.city !== cityFilter) return false;
      return true;
    });
  }, [templates, tab, cityFilter]);

  const activeOrCompletedMissions = useMemo(
    () =>
      myMissions.filter(
        (m) =>
          m.status === 'IN_PROGRESS' ||
          m.status === 'PENDING' ||
          m.status === 'COMPLETED',
      ),
    [myMissions],
  );

  return (
    <div className="space-y-5">
      {/* Header + Optional Player Agency Notice */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-amber-400">
              Centro de Misiones · Progresión Profunda
            </h2>
            <p className="mt-1 text-xs text-zinc-300">
              Todas las misiones son{' '}
              <strong className="text-amber-300">100% opcionales</strong>: tú
              decides si hacerlas o saltarlas. Completarlas acelera tu subida de
              nivel, Pase de Batalla, Reputación y desbloquea armas/kits antes
              que nadie.
            </p>
          </div>
          {player && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-300">
              Nivel actual:{' '}
              <span className="font-bold text-amber-400">{player.level}</span> ·
              XP:{' '}
              <span className="font-semibold text-emerald-300">
                {player.xp}
              </span>
            </div>
          )}
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
          {msg}
        </div>
      )}
      {errMsg && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {errMsg}
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              {
                id: 'STORY',
                label: `Historia (${templates.filter((t) => (t.mode ?? 'ONLINE_SOLO') === 'STORY').length})`,
              },
              {
                id: 'ONLINE_SOLO',
                label: `Online Individual (${templates.filter((t) => (t.mode ?? 'ONLINE_SOLO') === 'ONLINE_SOLO').length})`,
              },
              {
                id: 'ONLINE_COOP',
                label: `Online con Amigos (${templates.filter((t) => (t.mode ?? 'ONLINE_SOLO') === 'ONLINE_COOP').length})`,
              },
              {
                id: 'MY',
                label: `En curso / Completadas (${activeOrCompletedMissions.length})`,
              },
            ] as Array<{ id: MissionTab; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                tab === item.id
                  ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab !== 'MY' && (
          <select
            aria-label="Filtrar por ciudad"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200"
          >
            <option value="ALL">Todas las ciudades</option>
            {availableCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Active & Claimable Missions Strip (always visible when on MY tab or when any are active) */}
      {(tab === 'MY' || activeOrCompletedMissions.length > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-200">
            Tus misiones activas ({activeOrCompletedMissions.length})
          </h3>
          {activeOrCompletedMissions.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No tienes misiones activas. Puedes explorar libremente el mapa o
              aceptar contratos abajo cuando quieras.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {activeOrCompletedMissions.map((m) => {
                const steps = m.template.requiredSteps ?? 3;
                const doneSteps = Math.min(
                  steps,
                  Math.round((m.progress / 100) * steps),
                );
                const isCoop = m.template.mode === 'ONLINE_COOP';
                const rawMinStep = m.template.requirement?.minStepSeconds;
                const stepSec =
                  typeof rawMinStep === 'number' &&
                  Number.isFinite(rawMinStep) &&
                  rawMinStep > 0
                    ? rawMinStep
                    : STEP_COOLDOWN_SEC[m.template.difficulty];
                const lastStepMs = m.lastStepAt
                  ? new Date(m.lastStepAt).getTime()
                  : 0;
                const elapsedSec =
                  lastStepMs > 0 ? (nowMs - lastStepMs) / 1000 : stepSec;
                const remainingSec =
                  m.status === 'IN_PROGRESS' && lastStepMs > 0
                    ? Math.max(0, Math.ceil(stepSec - elapsedSec))
                    : 0;
                const isOwner = m.playerId
                  ? m.playerId === player?.id
                  : m.player?.id
                    ? m.player.id === player?.id
                    : m.coOpParticipants?.find((p) => p.playerId === player?.id)
                        ?.role !== 'MEMBER';

                return (
                  <li
                    key={m.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3.5 text-sm space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-zinc-100">
                            {m.template.title}
                          </span>
                          {m.template.city && (
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-sky-300">
                              {m.template.city}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">
                          {m.template.description}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${DIFFICULTY_BADGE[m.template.difficulty]}`}
                      >
                        {m.template.difficulty}
                      </span>
                    </div>

                    {isCoop && m.squadCode && (
                      <div className="rounded-lg border border-purple-500/30 bg-purple-950/25 px-2.5 py-1.5 text-xs text-purple-200">
                        Código de escuadra:{' '}
                        <span className="font-mono font-bold text-purple-300">
                          {m.squadCode}
                        </span>{' '}
                        · Amigos: {m.coOpParticipants?.length ?? 1}/
                        {m.template.maxPlayers ?? 4} (mín.{' '}
                        {m.template.minPlayers ?? 2})
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>
                          Fases: {doneSteps}/{steps}
                        </span>
                        <span>{m.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full bg-amber-400 transition-all"
                          style={{ width: `${m.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-emerald-400">
                        +{m.template.rewardEuros}€ · +{m.template.rewardXp} XP
                        {m.template.rewardItemName
                          ? ` · Ítem: ${m.template.rewardItemName}`
                          : ''}
                      </span>

                      <div className="flex flex-wrap gap-2">
                        {m.status === 'IN_PROGRESS' && (
                          <>
                            <button
                              type="button"
                              disabled={
                                busy === `adv-${m.id}` || remainingSec > 0
                              }
                              onClick={() =>
                                void runAction(
                                  `adv-${m.id}`,
                                  () => api.advanceMission(m.id),
                                  'Fase táctica completada',
                                )
                              }
                              className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {remainingSec > 0
                                ? `Espera ${remainingSec}s`
                                : 'Ejecutar fase'}
                            </button>
                            {isCoop && !isOwner ? (
                              <button
                                type="button"
                                disabled={busy === `leave-${m.id}`}
                                onClick={() =>
                                  void runAction(
                                    `leave-${m.id}`,
                                    () => api.leaveCoopMission(m.id),
                                    'Has salido de la escuadra co-op',
                                  )
                                }
                                className="rounded-md border border-purple-500/40 px-2 py-1 text-xs text-purple-300 hover:text-purple-100 disabled:opacity-50"
                              >
                                Salir de escuadra
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy === `abn-${m.id}`}
                                onClick={() =>
                                  void runAction(
                                    `abn-${m.id}`,
                                    () => api.abandonMission(m.id),
                                    'Misión abandonada (sin penalización)',
                                  )
                                }
                                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                              >
                                Abandonar
                              </button>
                            )}
                          </>
                        )}
                        {m.status === 'COMPLETED' && (
                          <button
                            type="button"
                            disabled={busy === `clm-${m.id}`}
                            onClick={() =>
                              void runAction(
                                `clm-${m.id}`,
                                () => api.claimMission(m.id),
                                '¡Recompensa y beneficios cobrados!',
                                true,
                              )
                            }
                            className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                          >
                            Cobrar recompensas
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Online Co-op Join Squad Panel */}
      {tab === 'ONLINE_COOP' && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-950/15 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-purple-300">
                Jugar con Amigos · Unirse a Escuadra Co-op (+20% XP/€)
              </h3>
              <p className="text-xs text-zinc-400">
                Introduce el código que te pase un amigo o únete a una escuadra
                abierta.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ej. VL-A1B2C3"
                value={squadCodeInput}
                onChange={(e) => setSquadCodeInput(e.target.value)}
                className="w-36 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs uppercase text-zinc-100"
              />
              <button
                type="button"
                disabled={!squadCodeInput.trim() || busy === 'join-code'}
                onClick={() =>
                  void runAction(
                    'join-code',
                    () => api.joinCoopSquad(squadCodeInput.trim()),
                    'Te has unido a la escuadra de tus amigos',
                  )
                }
                className="rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-purple-400 disabled:opacity-50"
              >
                Unirse por código
              </button>
            </div>
          </div>

          {openSquads.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {openSquads.map((sq) => (
                <button
                  key={sq.id}
                  type="button"
                  disabled={busy === `join-${sq.id}`}
                  onClick={() =>
                    sq.squadCode &&
                    void runAction(
                      `join-${sq.id}`,
                      () => api.joinCoopSquad(sq.squadCode!),
                      `Unido a ${sq.template.title}`,
                    )
                  }
                  className="rounded-lg border border-purple-500/30 bg-zinc-900/80 px-2.5 py-1.5 text-left text-xs hover:border-purple-400"
                >
                  <div className="font-medium text-zinc-100">
                    {sq.template.title}
                  </div>
                  <div className="text-[11px] text-purple-300">
                    Líder: {sq.player?.displayName ?? 'Jugador'} · Código:{' '}
                    {sq.squadCode} · {sq.coOpParticipants?.length ?? 1}/
                    {sq.template.maxPlayers ?? 4}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Catalog for Selected Tab */}
      {tab !== 'MY' && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-300">
            Catálogo · {MODE_LABELS[tab]} ({filteredTemplates.length})
          </h3>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filteredTemplates.map((t) => {
              const isActive = activeTemplateIds.has(t.id);
              const isSkipped = skippedTemplateIds.has(t.id);
              const isCompletedUnique = completedUniqueTemplateIds.has(t.id);
              const cooldownHoursLeft =
                cooldownHoursByTemplateId.get(t.id) ?? 0;
              const lockedByLevel =
                Boolean(player?.level) &&
                (t.minLevel ?? 1) > (player?.level ?? 1);
              const isVipActive = Boolean(
                player?.isVip &&
                (!player.vipExpiresAt ||
                  new Date(player.vipExpiresAt).getTime() > Date.now()),
              );
              const lockedByVip = Boolean(t.isVipOnly && !isVipActive);
              const isCoop = (t.mode ?? 'ONLINE_SOLO') === 'ONLINE_COOP';

              return (
                <li
                  key={t.id}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 text-sm ${
                    t.isVipOnly
                      ? 'border-amber-500/40 bg-amber-950/10'
                      : 'border-zinc-800 bg-zinc-900/50'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {t.isVipOnly && (
                            <span className="rounded border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                              👑 SOLO VIP
                            </span>
                          )}
                          <span className="font-semibold text-zinc-100">
                            {t.title}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                          {t.city && (
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">
                              {t.city}
                            </span>
                          )}
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                            Nv. mín {t.minLevel ?? 1}
                          </span>
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                            {t.requiredSteps ?? 3} fases
                          </span>
                          {isCoop && (
                            <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-300">
                              {t.minPlayers ?? 2}-{t.maxPlayers ?? 4} amigos
                            </span>
                          )}
                          {t.cooldownHours ? (
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-amber-300">
                              CD {t.cooldownHours}h
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${DIFFICULTY_BADGE[t.difficulty]}`}
                      >
                        {t.difficulty}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400">{t.description}</p>

                    {t.unlockBenefit && (
                      <div className="rounded-md border border-emerald-500/25 bg-emerald-950/20 px-2 py-1 text-[11px] text-emerald-300">
                        Beneficio: {t.unlockBenefit}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-2.5">
                    <div className="text-xs text-emerald-400">
                      +{t.rewardEuros}€ · +{t.rewardXp} XP
                      {t.rewardVidaCoins ? ` · +${t.rewardVidaCoins} VC` : ''}
                      {t.rewardItemName ? ` · 🎁 ${t.rewardItemName}` : ''}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isActive &&
                        !isCompletedUnique &&
                        t.isOptional !== false && (
                          <button
                            type="button"
                            disabled={busy === `skip-${t.id}` || isSkipped}
                            onClick={() =>
                              void runAction(
                                `skip-${t.id}`,
                                () => api.skipMission(t.id),
                                'Misión marcada como omitida (puedes aceptarla cuando quieras)',
                              )
                            }
                            className="text-[11px] text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                          >
                            {isSkipped ? 'Omitida' : 'Omitir'}
                          </button>
                        )}
                      <button
                        type="button"
                        disabled={
                          isActive ||
                          isCompletedUnique ||
                          cooldownHoursLeft > 0 ||
                          lockedByLevel ||
                          lockedByVip ||
                          busy === t.id
                        }
                        onClick={() =>
                          void runAction(
                            t.id,
                            () =>
                              isCoop
                                ? api.createCoopSquad(t.id)
                                : api.startMission(t.id),
                            isCoop
                              ? 'Escuadra Co-op creada: comparte el código con tus amigos'
                              : 'Misión aceptada',
                          )
                        }
                        className="rounded-md bg-amber-500/90 px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                      >
                        {isActive
                          ? 'En curso'
                          : isCompletedUnique
                            ? 'Completada ✓'
                            : cooldownHoursLeft > 0
                              ? `CD ~${cooldownHoursLeft}h`
                              : lockedByVip
                                ? 'Solo Club VIP'
                                : lockedByLevel
                                  ? `Req. Nv ${t.minLevel}`
                                  : isCoop
                                    ? 'Crear Escuadra'
                                    : 'Aceptar'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
