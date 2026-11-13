'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { BattlePassProgress, PlayerSkill, Skill } from '@/types/game';

export default function SkillsBattlePass() {
  const { token } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [mySkills, setMySkills] = useState<PlayerSkill[]>([]);
  const [bp, setBp] = useState<BattlePassProgress | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [allSkills, playerSkills, battlePass] = await Promise.all([
        api.skills() as Promise<Skill[]>,
        api.mySkills() as Promise<PlayerSkill[]>,
        api
          .myBattlePass()
          .catch(() => null) as Promise<BattlePassProgress | null>,
      ]);
      setSkills(Array.isArray(allSkills) ? allSkills : []);
      setMySkills(Array.isArray(playerSkills) ? playerSkills : []);
      setBp(battlePass);
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
      setMsg('Skill entrenada (+50 XP)');
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function claimBp(level: number) {
    setBusy(`bp-${level}`);
    setMsg('');
    try {
      await api.claimBattlePass(level);
      setMsg(`Recompensa de nivel ${level} cobrada`);
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  const skillMap = new Map(mySkills.map((ps) => [ps.skill.id, ps]));

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}

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
                    disabled={busy === s.id}
                    onClick={() => {
                      void train(s.id);
                    }}
                    className="text-xs text-amber-400 underline disabled:opacity-50"
                  >
                    Entrenar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-amber-400">Battle Pass</h2>
        {bp ? (
          <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm space-y-2">
            <div className="font-medium">
              {bp.season?.name || 'Temporada activa'}
            </div>
            <div>Nivel: {bp.level}</div>
            <div className="text-xs text-zinc-500">XP: {bp.xp}</div>
            {!bp.rewardsClaimed.includes(bp.level) && (
              <button
                type="button"
                disabled={busy === `bp-${bp.level}`}
                onClick={() => {
                  void claimBp(bp.level);
                }}
                className="text-xs text-emerald-400 underline disabled:opacity-50"
              >
                Cobrar nivel {bp.level}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 mt-2">Sin temporada activa</p>
        )}
      </section>
    </div>
  );
}
