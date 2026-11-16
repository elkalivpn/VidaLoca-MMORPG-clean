'use client';

import { useEffect, useState } from 'react';
import type { FactionType, Player } from '@/types/game';
import { isSfxMuted, setSfxMuted } from '@/lib/sfx';

const FACTION_BADGES: Record<
  FactionType,
  { label: string; icon: string; className: string }
> = {
  POLICE: {
    label: 'CNP',
    icon: '🛡️',
    className: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
  },
  GUARDIA_CIVIL: {
    label: 'Guardia Civil',
    icon: '⚔️',
    className: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  },
  SYNDICATE: {
    label: 'Sindicato',
    icon: '🕶️',
    className: 'border-red-500/40 bg-red-500/15 text-red-300',
  },
  ENTREPRENEUR: {
    label: 'Gremio',
    icon: '💼',
    className: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  },
  CIVILIAN: {
    label: 'Civil',
    icon: '🏙️',
    className: 'border-zinc-700 bg-zinc-800/70 text-zinc-300',
  },
  ERTZAINTZA_MOSSOS: {
    label: 'Autonómicas',
    icon: '🚓',
    className: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300',
  },
  CYBER_HACKER: {
    label: 'ShadowNet',
    icon: '💻',
    className: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300',
  },
  CARTEL_MARITIMO: {
    label: 'Portuaria',
    icon: '⚓',
    className: 'border-teal-500/40 bg-teal-500/15 text-teal-300',
  },
  NIGHT_RACING: {
    label: 'Apex Racing',
    icon: '🏎️',
    className: 'border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300',
  },
};

export default function StatsBar({
  player,
  connected,
  onLogout,
}: {
  player: Player | null;
  connected: boolean;
  onLogout: () => void;
}) {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isSfxMuted());
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setSfxMuted(next);
    setMuted(next);
  };

  const factionKey: FactionType = player?.faction ?? 'CIVILIAN';
  const factionBadge = FACTION_BADGES[factionKey] ?? FACTION_BADGES.CIVILIAN;
  const wantedLevel = Math.min(5, Math.max(0, player?.wantedLevel ?? 0));
  const inJail = Boolean(
    player?.jailUntil && new Date(player.jailUntil).getTime() > Date.now(),
  );
  const isVipActive = Boolean(
    player?.isVip &&
    (!player.vipExpiresAt ||
      new Date(player.vipExpiresAt).getTime() > Date.now()),
  );
  const isGuest = Boolean(player?.user?.isGuest);

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 bg-zinc-900/90 px-3 py-2 text-sm">
      <span className="font-semibold text-amber-400">
        {player?.displayName}
      </span>
      {isVipActive && (
        <span
          className="inline-flex items-center gap-1 rounded border border-amber-400/60 bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-bold text-amber-200"
          title="Club VIP activo (+25% XP global)"
        >
          👑 VIP
        </span>
      )}
      {isGuest && (
        <span
          className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 text-[11px] font-medium text-sky-300"
          title="Cuenta temporal de invitado"
        >
          Invitado
        </span>
      )}
      <span
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${factionBadge.className}`}
        title={`Facción: ${factionBadge.label}${player?.factionRank ? ` (Rango ${player.factionRank})` : ''}`}
      >
        <span>{factionBadge.icon}</span>
        <span>{factionBadge.label}</span>
      </span>
      {wantedLevel > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300"
          title={`Nivel de búsqueda: ${wantedLevel}/5`}
        >
          {'★'.repeat(wantedLevel)}
          {'☆'.repeat(5 - wantedLevel)}
        </span>
      )}
      {inJail && (
        <span className="inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-950/60 px-1.5 py-0.5 text-[11px] font-semibold text-red-300">
          ⛓️ Calabozo
        </span>
      )}
      <span className="text-zinc-500">|</span>
      <span className="text-zinc-300">
        € {Math.round(player?.euros ?? 0).toLocaleString('es-ES')}
      </span>
      <span className="text-amber-300 font-medium">
        VC {player?.vidaCoins ?? 0}
      </span>
      <span className="text-zinc-300">
        Nv.{player?.level ?? 1} · XP {player?.xp ?? 0}
      </span>
      <span className="text-zinc-300">Calor {player?.heat ?? 0}</span>
      <span className="text-zinc-500 text-xs">
        {player?.lifestyle || 'GREY'}
      </span>
      <span className="text-zinc-500 text-xs">{player?.locationId}</span>
      <span
        className={`ml-auto text-xs ${connected ? 'text-green-400' : 'text-zinc-600'}`}
      >
        {connected ? '● en vivo' : '○ offline'}
      </span>
      <button
        type="button"
        onClick={toggleMute}
        className="rounded border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-zinc-500"
        title={muted ? 'Activar efectos de sonido' : 'Silenciar efectos'}
      >
        {muted ? '🔇 Mute' : '🔊 SFX'}
      </button>
      <button
        type="button"
        onClick={onLogout}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        Salir
      </button>
    </header>
  );
}
