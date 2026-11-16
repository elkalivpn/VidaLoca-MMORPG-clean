'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { playCoinSfx, playLevelUpSfx } from '@/lib/sfx';
import type { EngagementStatus, LeaderboardsResponse } from '@/types/game';

type LbTab = 'richest' | 'topLevel' | 'mostWanted' | 'topClans';

export default function EngagementPanel() {
  const { token, player, refreshPlayer } = useAuth();
  const [status, setStatus] = useState<EngagementStatus | null>(null);
  const [boards, setBoards] = useState<LeaderboardsResponse | null>(null);
  const [lbTab, setLbTab] = useState<LbTab>('richest');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [st, lb] = await Promise.all([
        api.engagementStatus(),
        api.leaderboards(),
      ]);
      setStatus(st);
      setBoards(lb);
    } catch {
      /* ignore transient fetch errors */
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleClaimDaily() {
    if (!token || busyId) return;
    setBusyId('daily');
    setMsg('');
    try {
      const prevLevel = player?.level ?? 1;
      const res = await api.claimDaily();
      if ((res.player?.level ?? 1) > prevLevel) {
        playLevelUpSfx();
      } else {
        playCoinSfx();
      }
      setMsg(
        `¡Día ${res.day} reclamado! +${res.reward.euros.toLocaleString('es-ES')} €, +${res.reward.xp} XP${res.reward.vidaCoins ? `, +${res.reward.vidaCoins} VC` : ''}`,
      );
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error al reclamar diaria');
    } finally {
      setBusyId(null);
    }
  }

  async function handleClaimChallenge(challengeId: string) {
    if (!token || busyId) return;
    setBusyId(challengeId);
    setMsg('');
    try {
      const prevLevel = player?.level ?? 1;
      const res = await api.claimDailyChallenge(challengeId);
      if ((res.player?.level ?? 1) > prevLevel) {
        playLevelUpSfx();
      } else {
        playCoinSfx();
      }
      setMsg(
        `¡Reto completado! +${res.reward.euros.toLocaleString('es-ES')} €, +${res.reward.xp} XP, +${res.reward.vidaCoins} VC`,
      );
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error al reclamar reto');
    } finally {
      setBusyId(null);
    }
  }

  function copyReferralLink() {
    if (!status?.referralCode || typeof window === 'undefined') return;
    const url = `${window.location.origin}/?ref=${status.referralCode}`;
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const inviteUrl =
    typeof window !== 'undefined' && status?.referralCode
      ? `${window.location.origin}/?ref=${status.referralCode}`
      : status?.referralCode
        ? `/?ref=${status.referralCode}`
        : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-400">
            Recompensas Diarias, Retos &amp; Rankings
          </h2>
          <p className="text-xs text-zinc-400">
            Entra cada día para multiplicar tus euros y VidaCoins, completa
            retos y escala en el ranking de España.
          </p>
        </div>
        {status?.isVip && (
          <span className="rounded-full border border-amber-400/50 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-200">
            👑 Bonus VIP activo (+25% XP)
          </span>
        )}
      </div>

      {msg && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {msg}
        </p>
      )}

      {/* 1. Racha Diaria 7 Días */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Racha de Conexión (Día {status?.loginStreak ?? 0}/7)
            </h3>
            <p className="text-xs text-zinc-400">
              {status?.canClaimDaily
                ? `Disponible ahora: Día ${status.nextDay} (+${status.nextReward.euros.toLocaleString('es-ES')} €, +${status.nextReward.xp} XP${status.nextReward.vidaCoins ? `, +${status.nextReward.vidaCoins} VC` : ''})`
                : status?.nextClaimAt
                  ? `Próxima recompensa disponible a las ${new Date(status.nextClaimAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Reclamado hoy — vuelve mañana para continuar la racha.'}
            </p>
          </div>
          <button
            type="button"
            disabled={!status?.canClaimDaily || busyId === 'daily'}
            onClick={() => {
              void handleClaimDaily();
            }}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              status?.canClaimDaily
                ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                : 'border border-zinc-700 bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {busyId === 'daily'
              ? 'Reclamando…'
              : status?.canClaimDaily
                ? `Reclamar Día ${status.nextDay}`
                : 'Ya reclamado hoy ✓'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {(status?.streakTable ?? []).map((step) => {
            const isNext = status?.canClaimDaily && step.day === status.nextDay;
            const isCompleted =
              (status?.loginStreak ?? 0) >= step.day && !isNext;
            return (
              <div
                key={step.day}
                className={`rounded-lg border p-2.5 text-center text-xs ${
                  isNext
                    ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                    : isCompleted
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-zinc-800 bg-zinc-950/70 text-zinc-400'
                }`}
              >
                <div className="font-bold">
                  Día {step.day} {isCompleted ? '✓' : ''}
                </div>
                <div className="mt-1 font-semibold text-zinc-100">
                  +{step.euros.toLocaleString('es-ES')} €
                </div>
                <div className="text-[11px] text-zinc-400">+{step.xp} XP</div>
                {step.vidaCoins > 0 && (
                  <div className="mt-0.5 text-[11px] font-bold text-amber-300">
                    +{step.vidaCoins} VC
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Retos Diarios */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">
            Retos Diarios de Hoy
          </h3>
          <p className="text-xs text-zinc-400">
            Completa acciones en la calle, viajes, comercio o misiones para
            ganar VidaCoins gratis.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(status?.dailyChallenges ?? []).map((ch) => {
            const pct = Math.min(
              100,
              Math.round((ch.progress / ch.target) * 100),
            );
            const ready = ch.progress >= ch.target && !ch.claimed;
            return (
              <div
                key={ch.id}
                className="flex flex-col justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-zinc-100">
                      {ch.title}
                    </span>
                    <span className="text-[11px] font-bold text-amber-300">
                      +{ch.rewardVidaCoins} VC
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{ch.description}</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>
                      Progreso: {ch.progress}/{ch.target}
                    </span>
                    <span>
                      +{ch.rewardEuros.toLocaleString('es-ES')} € · +
                      {ch.rewardXp} XP
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full transition-all ${
                        ch.claimed
                          ? 'bg-emerald-500'
                          : ready
                            ? 'bg-amber-400'
                            : 'bg-sky-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!ready || busyId === ch.id}
                    onClick={() => {
                      void handleClaimChallenge(ch.id);
                    }}
                    className={`w-full rounded-md py-1.5 text-xs font-bold transition ${
                      ch.claimed
                        ? 'bg-emerald-500/15 text-emerald-300 cursor-default'
                        : ready
                          ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {ch.claimed
                      ? 'Reclamado ✓'
                      : busyId === ch.id
                        ? 'Reclamando…'
                        : ready
                          ? 'Reclamar Recompensa'
                          : 'En progreso'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Programa de Referidos */}
      <section className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-amber-300">
              Invita Amigos y Gana 2.500 € + 25 VC
            </h3>
            <p className="text-xs text-zinc-400">
              Cuando un amigo se registra con tu enlace (o convierte su cuenta
              de invitado), ambos recibís un bono de euros y VidaCoins.
            </p>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-200">
            Reclutados: {status?.referralsCount ?? 0}
          </span>
        </div>
        {status?.referralCode && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <code className="flex-1 min-w-[200px] truncate rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-amber-200">
              {inviteUrl}
            </code>
            <button
              type="button"
              onClick={copyReferralLink}
              className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
            >
              {copied ? 'Enlace copiado ✓' : 'Copiar Enlace'}
            </button>
          </div>
        )}
      </section>

      {/* 4. Leaderboards Globales */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100">
            Rankings de España (Top 10)
          </h3>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                ['richest', 'Más Ricos'],
                ['topLevel', 'Mayor Nivel'],
                ['mostWanted', 'Más Buscados'],
                ['topClans', 'Clanes Imperio'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLbTab(id)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  lbTab === id
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!boards ? (
          <p className="text-xs text-zinc-500">Cargando clasificación…</p>
        ) : lbTab === 'topClans' ? (
          <ul className="space-y-1.5">
            {boards.topClans.length === 0 ? (
              <li className="text-xs text-zinc-500">
                Aún no hay clanes registrados.
              </li>
            ) : (
              boards.topClans.map((c, idx) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 font-bold text-amber-400">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-zinc-100">
                      [{c.tag}] {c.name}
                    </span>
                    <span className="text-zinc-500">Nv.{c.level}</span>
                  </div>
                  <div className="text-right text-zinc-300">
                    {c.funds.toLocaleString('es-ES')} € · {c.membersCount}{' '}
                    miembros · {c.territoriesCount} zonas
                  </div>
                </li>
              ))
            )}
          </ul>
        ) : (
          <ul className="space-y-1.5">
            {(boards[lbTab] ?? []).length === 0 ? (
              <li className="text-xs text-zinc-500">Sin registros todavía.</li>
            ) : (
              (boards[lbTab] ?? []).map((p, idx) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                    p.id === player?.id
                      ? 'border-amber-400/60 bg-amber-500/10'
                      : 'border-zinc-800 bg-zinc-950/70'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 font-bold text-amber-400">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-zinc-100">
                      {p.isVip ? '👑 ' : ''}
                      {p.displayName}
                    </span>
                    {p.clanTag && (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                        [{p.clanTag}]
                      </span>
                    )}
                    <span className="text-zinc-500">Nv.{p.level}</span>
                  </div>
                  <div className="text-right font-medium text-zinc-200">
                    {lbTab === 'mostWanted'
                      ? `Calor ${p.heat} · ${p.locationId ?? 'España'}`
                      : lbTab === 'topLevel'
                        ? `Nv.${p.level} · Rep ${p.reputation}`
                        : `${p.euros.toLocaleString('es-ES')} €`}
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
