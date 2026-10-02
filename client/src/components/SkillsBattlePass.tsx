'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function SkillsBattlePass() {
  const { token } = useAuth();
  const [skills, setSkills] = useState<any[]>([]);
  const [bp, setBp] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    api.get('/skills', token).then((d) => setSkills(Array.isArray(d) ? d : d.skills || [])).catch(() => {});
    api.get('/battle-pass', token).then(setBp).catch(() => {});
  }, [token]);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-amber-400">Skills</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {skills.map((s) => (
            <li key={s.id || s.key} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
              <div className="font-medium">{s.name || s.key}</div>
              <div className="text-xs text-zinc-500">Nivel {s.level ?? 0}</div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-amber-400">Battle Pass</h2>
        {bp ? (
          <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
            <div>Nivel: {bp.level ?? bp.tier ?? '—'}</div>
            <div className="text-xs text-zinc-500">XP: {bp.xp ?? bp.experience ?? '—'}</div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 mt-2">Sin datos</p>
        )}
      </section>
    </div>
  );
}
