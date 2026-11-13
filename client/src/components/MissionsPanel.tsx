'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { MissionTemplate, PlayerMission } from '@/types/game';

export default function MissionsPanel() {
  const { token, refreshPlayer } = useAuth();
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [myMissions, setMyMissions] = useState<PlayerMission[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [tpls, mine] = await Promise.all([
        api.missionTemplates() as Promise<MissionTemplate[]>,
        api.myMissions() as Promise<PlayerMission[]>,
      ]);
      setTemplates(Array.isArray(tpls) ? tpls : []);
      setMyMissions(Array.isArray(mine) ? mine : []);
    } catch {
      setTemplates([]);
      setMyMissions([]);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function start(templateId: string) {
    if (!token) return;
    setBusy(templateId);
    setMsg('');
    try {
      await api.startMission(templateId);
      setMsg('Misión aceptada');
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function claim(missionId: string) {
    if (!token) return;
    setBusy(missionId);
    setMsg('');
    try {
      await api.claimMission(missionId);
      setMsg('Recompensa cobrada');
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  const activeTemplateIds = new Set(
    myMissions
      .filter((m) => m.status === 'PENDING' || m.status === 'IN_PROGRESS')
      .map((m) => m.template.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-amber-400">Mis misiones</h2>
        {msg && <p className="text-sm text-zinc-300 mt-1">{msg}</p>}
        {myMissions.length === 0 ? (
          <p className="text-sm text-zinc-500 mt-2">
            No tienes misiones activas.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {myMissions.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{m.template.title}</span>
                  <span className="text-xs text-zinc-500">
                    {m.template.difficulty}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {m.template.description}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs text-zinc-400">
                    Progreso: {m.progress}%
                  </span>
                  <span className="text-xs text-zinc-600">{m.status}</span>
                  {m.status === 'COMPLETED' && (
                    <button
                      type="button"
                      disabled={busy === m.id}
                      onClick={() => {
                        void claim(m.id);
                      }}
                      className="text-xs text-green-400 underline disabled:opacity-50"
                    >
                      Cobrar ({m.template.rewardEuros} € / {m.template.rewardXp}{' '}
                      XP)
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-300">
          Misiones disponibles
        </h3>
        <ul className="mt-2 space-y-2">
          {templates.map((t) => {
            const isActive = activeTemplateIds.has(t.id);
            return (
              <li
                key={t.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t.title}</span>
                  <span className="text-xs text-zinc-500">{t.difficulty}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {t.description}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-emerald-400">
                    +{t.rewardEuros} € · +{t.rewardXp} XP
                  </span>
                  <button
                    type="button"
                    disabled={isActive || busy === t.id}
                    onClick={() => {
                      void start(t.id);
                    }}
                    className="text-xs text-amber-400 underline disabled:opacity-40"
                  >
                    {isActive ? 'En curso' : 'Aceptar'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
