'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { MissionTemplate, PlayerMission } from '@/types/game';

const DIFF_COLOR: Record<string, string> = {
  EASY: 'text-emerald-400 border-emerald-800',
  MEDIUM: 'text-sky-400 border-sky-800',
  HARD: 'text-amber-400 border-amber-800',
  SUICIDE: 'text-red-400 border-red-800',
};

export function MissionsPanel({ onReward }: { onReward?: () => void }) {
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [myMissions, setMyMissions] = useState<PlayerMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'available' | 'active'>('available');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [t, m] = await Promise.all([
        api.missionTemplates() as Promise<MissionTemplate[]>,
        api.myMissions() as Promise<PlayerMission[]>,
      ]);
      setTemplates(t || []);
      setMyMissions(m || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const start = async (templateId: string) => {
    setActionLoading(templateId);
    setError('');
    try {
      await api.startMission(templateId);
      await load();
      setTab('active');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const progress = async (missionId: string, current: number) => {
    setActionLoading(missionId);
    try {
      const next = Math.min(100, current + 25);
      await api.updateMissionProgress(missionId, next);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const claim = async (missionId: string) => {
    setActionLoading(missionId);
    try {
      await api.claimMission(missionId);
      await load();
      onReward?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="card text-zinc-500 animate-pulse">Cargando misiones...</div>;
  }

  const active = myMissions.filter(
    (m) => m.status === 'IN_PROGRESS' || m.status === 'COMPLETED',
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Misiones</h2>
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setTab('available')}
            className={`px-3 py-1 text-sm rounded-md transition ${
              tab === 'available' ? 'bg-amber-600 text-black' : 'text-zinc-400'
            }`}
          >
            Disponibles
          </button>
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`px-3 py-1 text-sm rounded-md transition ${
              tab === 'active' ? 'bg-amber-600 text-black' : 'text-zinc-400'
            }`}
          >
            Activas ({active.length})
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-3 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {tab === 'available' && (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {templates.length === 0 && (
            <p className="text-zinc-500 text-sm">No hay misiones. Ejecuta el seed del backend.</p>
          )}
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${
                      DIFF_COLOR[t.difficulty] || ''
                    }`}
                  >
                    {t.difficulty}
                  </span>
                  <h3 className="font-semibold text-zinc-100 truncate">{t.title}</h3>
                </div>
                <p className="text-zinc-500 text-sm mt-1 line-clamp-2">{t.description}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  <span className="text-emerald-400">+{t.rewardEuros}€</span>
                  {' · '}
                  <span className="text-amber-400">+{t.rewardXp} XP</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => start(t.id)}
                disabled={actionLoading === t.id}
                className="btn-secondary text-sm shrink-0"
              >
                {actionLoading === t.id ? '...' : 'Aceptar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'active' && (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {active.length === 0 && (
            <p className="text-zinc-500 text-sm">No tienes misiones activas.</p>
          )}
          {active.map((m) => (
            <div
              key={m.id}
              className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{m.template.title}</h3>
                <span className="text-xs text-zinc-500">{m.status}</span>
              </div>
              <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${m.progress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">{m.progress}%</p>
              <div className="flex gap-2 mt-3">
                {m.status === 'IN_PROGRESS' && (
                  <button
                    type="button"
                    onClick={() => progress(m.id, m.progress)}
                    disabled={!!actionLoading}
                    className="btn-secondary text-sm"
                  >
                    Avanzar +25%
                  </button>
                )}
                {m.status === 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() => claim(m.id)}
                    disabled={!!actionLoading}
                    className="btn-primary text-sm"
                  >
                    Reclamar recompensa
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
