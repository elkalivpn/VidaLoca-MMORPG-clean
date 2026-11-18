'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type {
  Achievement,
  BattlePassProgress,
  PlayerAchievement,
  PlayerSkill,
  Skill,
} from '@/types/game';

export default function SkillsBattlePass() {
  const { token, refreshPlayer } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [mySkills, setMySkills] = useState<PlayerSkill[]>([]);
  const [bp, setBp] = useState<BattlePassProgress | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [myAchievements, setMyAchievements] = useState<PlayerAchievement[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [trainCooldownSec, setTrainCooldownSec] = useState(0);

  useEffect(() => {
    if (trainCooldownSec <= 0) return;
    const t = window.setInterval(() => {
      setTrainCooldownSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [trainCooldownSec]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [allSkills, playerSkills, battlePass, allAch, playerAch] =
        await Promise.all([
          api.skills() as Promise<Skill[]>,
          api.mySkills() as Promise<PlayerSkill[]>,
          api
            .myBattlePass()
            .catch(() => null) as Promise<BattlePassProgress | null>,
          api.achievements().catch(() => []) as Promise<Achievement[]>,
          api.myAchievements().catch(() => []) as Promise<PlayerAchievement[]>,
        ]);
      setSkills(Array.isArray(allSkills) ? allSkills : []);
      setMySkills(Array.isArray(playerSkills) ? playerSkills : []);
      setBp(battlePass);
      setAchievements(Array.isArray(allAch) ? allAch : []);
      setMyAchievements(Array.isArray(playerAch) ? playerAch : []);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function train(skillId: string) {
    setBusy(skillId);
    setMsg('');
    try {
      await api.trainSkill(skillId);
      setTrainCooldownSec(30);
      setMsg('Skill entrenada (+50 XP)');
      await load();
    } catch (e: unknown) {
      const errTxt = e instanceof Error ? e.message : 'Error';
      setMsg(errTxt);
      if (errTxt.toLowerCase().includes('descansar')) {
        setTrainCooldownSec((prev) => (prev > 0 ? prev : 15));
      }
    } finally {
      setBusy(null);
    }
  }

  async function claimBp(level: number) {
    setBusy(`bp-${level}`);
    setMsg('');
    try {
      const res = (await api.claimBattlePass(level)) as {
        reward?: { euros: number; vida: number };
      };
      const r = res?.reward;
      setMsg(
        r
          ? `Nivel ${level} cobrado: +${r.euros.toLocaleString('es-ES')} €${r.vida > 0 ? ` y +${r.vida} VC` : ''}`
          : `Recompensa de nivel ${level} cobrada`,
      );
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function unlockBpPremium() {
    setBusy('bp-premium');
    setMsg('');
    try {
      await api.unlockBattlePassPremium();
      setMsg(
        '👑 ¡Pase Premium de Temporada activado! Ya puedes cobrar recompensas Premium con VidaCoins.',
      );
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function checkAchievements() {
    setBusy('ach-check');
    setMsg('');
    try {
      const unlocked = (await api.checkAchievements()) as PlayerAchievement[];
      if (Array.isArray(unlocked) && unlocked.length > 0) {
        setMsg(
          `¡Desbloqueaste ${unlocked.length} logro(s) nuevo(s)! Recompensas acreditadas.`,
        );
      } else {
        setMsg('No hay nuevos logros desbloqueados por ahora.');
      }
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  const skillMap = new Map(mySkills.map((ps) => [ps.skill.id, ps]));
  const unlockedAchIds = new Set(myAchievements.map((pa) => pa.achievement.id));
  const xpPerLevel = bp?.xpPerLevel ?? 200;
  const effectivePremium = Boolean(bp?.effectivePremium || bp?.isPremium);
  const premiumPrice = bp?.premiumPriceVida ?? 200;
  const maxVisibleTier = bp ? Math.min(100, Math.max(12, bp.level + 4)) : 12;

  return (
    <div className="space-y-6">
      {msg && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
          {msg}
        </p>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-amber-400">Battle Pass</h2>
          {bp && !effectivePremium && (
            <button
              type="button"
              disabled={busy === 'bp-premium'}
              onClick={() => {
                void unlockBpPremium();
              }}
              className="rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950 shadow hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
            >
              {busy === 'bp-premium'
                ? 'Activando…'
                : `👑 Desbloquear Pase Premium (${premiumPrice} VC)`}
            </button>
          )}
        </div>
        {bp ? (
          <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-bold text-white">
                  {bp.season?.name || 'Temporada activa'}
                </div>
                <div className="text-xs text-zinc-400">
                  Sube de nivel completando misiones, golpes y retos diarios.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                    effectivePremium
                      ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {bp.hasClubVip && !bp.isPremium
                    ? '👑 Premium Activo (Club VIP)'
                    : effectivePremium
                      ? '✨ Pase Premium Activo'
                      : 'Pase Gratuito'}
                </span>
                <span className="rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold text-sky-300">
                  Nivel {bp.level}/100
                </span>
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>Progreso al nivel {Math.min(100, bp.level + 1)}</span>
                <span className="font-semibold text-zinc-200">
                  {bp.xp} / {xpPerLevel} XP
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((bp.xp / xpPerLevel) * 100))}%`,
                  }}
                />
              </div>
              {!effectivePremium && (
                <p className="mt-1.5 text-[11px] text-amber-300/80">
                  Con Pase Premium (200 VC o Club VIP activo) ganas 2.5x Euros y{' '}
                  <strong>VidaCoins en todos los niveles</strong>.
                </p>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: maxVisibleTier }, (_, idx) => idx + 1).map(
                (lvl) => {
                  const unlocked = lvl <= bp.level;
                  const claimed = bp.rewardsClaimed.includes(lvl);
                  const freeEuros = lvl * 100;
                  const freeVc = lvl % 5 === 0 ? 5 : 0;
                  const premEuros = lvl * 250;
                  const premVc = lvl * 5;

                  return (
                    <div
                      key={lvl}
                      className={`rounded-lg border p-2.5 text-xs flex flex-col justify-between gap-2 ${
                        claimed
                          ? 'border-emerald-500/30 bg-emerald-950/20'
                          : unlocked
                            ? 'border-amber-400/60 bg-amber-950/20'
                            : 'border-zinc-800 bg-zinc-950/60 opacity-75'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">
                            Nivel {lvl}
                          </span>
                          <span className="text-[10px] font-semibold text-zinc-400">
                            {claimed
                              ? '✅ Cobrado'
                              : unlocked
                                ? '🎁 Disponible'
                                : '🔒 Bloqueado'}
                          </span>
                        </div>
                        <div className="mt-1.5 space-y-0.5 text-[11px]">
                          <div className="text-zinc-400">
                            Gratis: +{freeEuros.toLocaleString('es-ES')} €
                            {freeVc > 0 ? ` · +${freeVc} VC` : ''}
                          </div>
                          <div className="font-semibold text-amber-300">
                            👑 Premium: +{premEuros.toLocaleString('es-ES')} € ·
                            +{premVc} VC
                          </div>
                        </div>
                      </div>

                      {unlocked && !claimed && (
                        <button
                          type="button"
                          disabled={busy === `bp-${lvl}`}
                          onClick={() => {
                            void claimBp(lvl);
                          }}
                          className="w-full rounded bg-emerald-500 px-2 py-1 text-[11px] font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {busy === `bp-${lvl}`
                            ? 'Cobrando…'
                            : `Cobrar Nivel ${lvl}`}
                        </button>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 mt-2">Sin temporada activa</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-amber-400">Skills</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {skills.map((s) => {
            const ps = skillMap.get(s.id);
            const level = ps?.level ?? 0;
            const xp = ps?.xp ?? 0;
            return (
              <li
                key={s.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-zinc-500">
                    Nivel {level}/{s.maxLevel} · {xp} XP · {s.category}
                  </div>
                </div>
                {level < s.maxLevel && (
                  <button
                    type="button"
                    disabled={busy === s.id || trainCooldownSec > 0}
                    onClick={() => {
                      void train(s.id);
                    }}
                    className="text-xs text-amber-400 underline disabled:opacity-50 disabled:no-underline tabular-nums shrink-0"
                  >
                    {trainCooldownSec > 0
                      ? `Espera ${trainCooldownSec}s`
                      : 'Entrenar'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-amber-400">
            Logros ({myAchievements.length}/{achievements.length})
          </h2>
          <button
            type="button"
            disabled={busy === 'ach-check'}
            onClick={() => {
              void checkAchievements();
            }}
            className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {busy === 'ach-check' ? 'Comprobando…' : 'Comprobar logros'}
          </button>
        </div>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {achievements.map((a) => {
            const unlocked = unlockedAchIds.has(a.id);
            return (
              <li
                key={a.id}
                className={`rounded-lg border p-3 text-sm flex items-start justify-between gap-2 ${
                  unlocked
                    ? 'border-emerald-500/40 bg-emerald-950/20'
                    : 'border-zinc-800 bg-zinc-900/50'
                }`}
              >
                <div>
                  <div className="font-medium flex items-center gap-1.5">
                    <span>{unlocked ? '🏆' : '🔒'}</span>
                    <span>{a.name}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {a.description}
                  </div>
                </div>
                <div className="text-right text-xs shrink-0">
                  <div className="text-emerald-400">
                    +{a.rewardEuros.toLocaleString('es-ES')} €
                  </div>
                  {a.rewardVida > 0 && (
                    <div className="text-amber-300">+{a.rewardVida} VC</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
