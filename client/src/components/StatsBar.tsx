'use client';

import type { Player } from '@/types/game';

interface Props {
  player: Player;
}

export function StatsBar({ player }: Props) {
  const xpForLevel = 1000;
  const xpProgress = ((player.xp % xpForLevel) / xpForLevel) * 100;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="card py-3 px-4">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">Nivel</p>
        <p className="text-2xl font-bold text-white">{player.level}</p>
        <div className="mt-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <p className="text-zinc-600 text-[10px] mt-0.5">
          {player.xp % xpForLevel} / {xpForLevel} XP
        </p>
      </div>

      <div className="card py-3 px-4">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">Euros</p>
        <p className="text-2xl font-bold text-emerald-400">
          {Number(player.euros).toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0,
          })}
        </p>
      </div>

      <div className="card py-3 px-4">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">VidaCoins</p>
        <p className="text-2xl font-bold text-amber-400">
          {Number(player.vidaCoins).toLocaleString('es-ES')}
        </p>
      </div>

      <div className="card py-3 px-4">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">Reputación</p>
        <p className="text-2xl font-bold text-sky-400">{player.reputation}</p>
      </div>

      <div className="card py-3 px-4 col-span-2 md:col-span-1">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">Ubicación</p>
        <p className="text-lg font-semibold text-zinc-200 truncate">
          {player.locationId?.replace(/_/g, ' ') || 'Desconocida'}
        </p>
      </div>
    </div>
  );
}
