'use client';

export default function StatsBar({
  player,
  connected,
  onLogout,
}: {
  player: any;
  connected: boolean;
  onLogout: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 bg-zinc-900/90 px-3 py-2 text-sm">
      <span className="font-semibold text-amber-400">{player?.username}</span>
      <span className="text-zinc-500">|</span>
      <span className="text-zinc-300">€ {player?.euros ?? 0}</span>
      <span className="text-zinc-300">VC {player?.vidaCoins ?? 0}</span>
      <span className="text-zinc-300">XP {player?.xp ?? 0}</span>
      <span className="text-zinc-300">Calor {player?.heat ?? 0}</span>
      <span className="text-zinc-500 text-xs">{player?.lifestyle || 'GREY'}</span>
      <span className="text-zinc-500 text-xs">{player?.zoneId}</span>
      <span className={`ml-auto text-xs ${connected ? 'text-green-400' : 'text-zinc-600'}`}>
        {connected ? '● en vivo' : '○ offline'}
      </span>
      <button type="button" onClick={onLogout} className="text-xs text-zinc-500 hover:text-zinc-300">
        Salir
      </button>
    </header>
  );
}
