'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Skill, PlayerSkill, BattlePassProgress } from '@/types/game';

export function SkillsBattlePass({ onChange }: { onChange?: () => void }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [mySkills, setMySkills] = useState<PlayerSkill[]>([]);
  const [bp, setBp] = useState<BattlePassProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'skills' | 'pass'>('skills');

  const load = async () => {
    setLoading(true);
    try {
      const [all, mine, progress] = await Promise.all([
        api.skills() as Promise<Skill[]>,
        api.mySkills() as Promise<PlayerSkill[]>,
        api.myBattlePass() as Promise<BattlePassProgress>,
      ]);
      setSkills(all || []);
      setMySkills(mine || []);
      setBp(progress || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const train = async (skillId: string) => {
    setBusy(skillId);
    setError('');
    try {
      await api.trainSkill(skillId, 50);
      await load();
      onChange?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const claimBp = async (level: number) => {
    setBusy(`bp-${level}`);
    try {
      await api.claimBattlePass(level);
      await load();
      onChange?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="card text-zinc-500 animate-pulse">Cargando progresión...</div>;
  }

  const mySkillMap = new Map(mySkills.map((s) => [s.skill.id, s]));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Progresión</h2>
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setTab('skills')}
            className={`px-3 py-1 text-sm rounded-md ${
              tab === 'skills' ? 'bg-amber-600 text-black' : 'text-zinc-400'
            }`}
          >
            Skills
          </button>
          <button
            type="button"
            onClick={() => setTab('pass')}
            className={`px-3 py-1 text-sm rounded-md ${
              tab === 'pass' ? 'bg-amber-600 text-black' : 'text-zinc-400'
            }`}
          >
            Battle Pass
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-3 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {tab === 'skills' && (
        <div className="space-y-3 max-h-[420px] overflow-y-auto">
          {skills.map((s) => {
            const mine = mySkillMap.get(s.id);
            const level = mine?.level ?? 0;
            const xp = mine?.xp ?? 0;
            const xpNeed = Math.max(1, level) * 100;
            return (
              <div
                key={s.id}
                className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="text-xs text-zinc-500">{s.description}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {s.category} · Nivel {level}/{s.maxLevel}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => train(s.id)}
                    disabled={!!busy || level >= s.maxLevel}
                    className="btn-secondary text-sm shrink-0 disabled:opacity-40"
                  >
                    {level >= s.maxLevel ? 'MAX' : busy === s.id ? '...' : 'Entrenar'}
                  </button>
                </div>
                {level > 0 && level < s.maxLevel && (
                  <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500"
                      style={{ width: `${Math.min(100, (xp / xpNeed) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'pass' && bp && (
        <div>
          <div className="mb-4">
            <p className="text-zinc-500 text-sm">
              {bp.season?.name || 'Temporada activa'}
              {bp.isPremium && (
                <span className="ml-2 text-amber-400 text-xs">PREMIUM</span>
              )}
            </p>
            <p className="text-2xl font-bold mt-1">Nivel {bp.level}</p>
            <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                style={{ width: `${(bp.xp / 200) * 100}%` }}
              />
            </div>
            <p className="text-xs text-zinc-600 mt-1">{bp.xp} / 200 XP</p>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 max-h-[280px] overflow-y-auto">
            {Array.from({ length: Math.min(bp.level + 2, 30) }, (_, i) => i + 1).map(
              (lvl) => {
                const claimed = bp.rewardsClaimed?.includes(lvl);
                const reachable = lvl <= bp.level;
                return (
                  <button
                    key={lvl}
                    type="button"
                    disabled={!reachable || claimed || !!busy}
                    onClick={() => claimBp(lvl)}
                    className={`aspect-square rounded-lg text-xs font-bold border transition ${
                      claimed
                        ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400'
                        : reachable
                          ? 'bg-amber-900/30 border-amber-600 text-amber-300 hover:bg-amber-800/40'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                    }`}
                  >
                    {claimed ? '✓' : lvl}
                  </button>
                );
              },
            )}
          </div>
          <p className="text-zinc-600 text-xs mt-3">
            Reclama recompensas de los niveles alcanzados.
          </p>
        </div>
      )}
    </div>
  );
}
