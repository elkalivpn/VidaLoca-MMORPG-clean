'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useRealtime } from '@/hooks/useRealtime';
import { disconnectSocket } from '@/lib/socket';
import type { Player } from '@/types/game';
import { StatsBar } from '@/components/StatsBar';
import { CityMap } from '@/components/CityMap';
import { MissionsPanel } from '@/components/MissionsPanel';
import { VehiclesPanel } from '@/components/VehiclesPanel';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { SkillsBattlePass } from '@/components/SkillsBattlePass';
import { ChatPanel } from '@/components/ChatPanel';
import { ClansPanel } from '@/components/ClansPanel';
import { InventoryPanel } from '@/components/InventoryPanel';

type Tab = 'map' | 'missions' | 'vehicles' | 'properties' | 'progression' | 'clans' | 'inventory' | 'chat';

const TABS: { id: Tab; label: string }[] = [
  { id: 'map', label: 'Mapa' },
  { id: 'missions', label: 'Misiones' },
  { id: 'vehicles', label: 'Vehículos' },
  { id: 'properties', label: 'Propiedades' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'clans', label: 'Clanes' },
  { id: 'progression', label: 'Skills & BP' },
  { id: 'chat', label: 'Chat' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { setAuth, logout } = useAuthStore();
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('map');
  const [wsEnabled, setWsEnabled] = useState(false);

  const {
    connected,
    zonePlayers,
    onlineTotal,
    messages,
    worldEvents,
    joinZone,
    sendZoneChat,
    sendGlobalChat,
    requestPresence,
  } = useRealtime(wsEnabled);

  const load = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.replace('/');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = (await api.me()) as Player;
      setLocalPlayer(data);
      setAuth(null, data);
      setWsEnabled(true);
    } catch (e: any) {
      setError(e.message);
      if (
        e.message?.includes('Unauthorized') ||
        e.message?.includes('401') ||
        e.message?.toLowerCase().includes('not found')
      ) {
        logout();
        disconnectSocket();
        router.replace('/');
      }
    } finally {
      setLoading(false);
    }
  }, [router, setAuth, logout]);

  useEffect(() => {
    load();
    return () => {
      // keep socket for session; disconnect on logout only
    };
  }, [load]);

  useEffect(() => {
    if (connected) requestPresence();
  }, [connected, requestPresence]);

  const handleTravel = async (locationId: string) => {
    setLocalPlayer((p) => (p ? { ...p, locationId } : p));
    await load();
  };

  const handleEconomyChange = () => {
    load();
  };

  const handleLogout = () => {
    disconnectSocket();
    logout();
    router.replace('/');
  };

  if (loading && !localPlayer) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-400 animate-pulse">Cargando tu vida loca...</p>
      </main>
    );
  }

  if (!localPlayer) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || 'No se pudo cargar el jugador'}</p>
        <button type="button" className="btn-secondary" onClick={() => router.replace('/')}>
          Volver al inicio
        </button>
      </main>
    );
  }

  const p = localPlayer;

  return (
    <main className="min-h-screen pb-16">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-xl font-black tracking-tight shrink-0">
              <span className="text-amber-500">VIDA</span>
              <span className="text-white">LOCA</span>
            </h1>
            <span className="text-zinc-600 hidden sm:inline">|</span>
            <p className="text-zinc-300 font-medium truncate">
              {p.displayName}
              <span className="text-zinc-600 text-sm font-normal ml-2">
                Nv. {p.level}
              </span>
            </p>
            <span
              className={`hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                connected
                  ? 'border-emerald-800 text-emerald-400 bg-emerald-950/40'
                  : 'border-zinc-700 text-zinc-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? 'bg-emerald-400' : 'bg-zinc-600'
                }`}
              />
              {connected ? 'EN VIVO' : 'OFFLINE'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        <StatsBar player={p} />

        {worldEvents.length > 0 && (() => {
          const ev = worldEvents[worldEvents.length - 1] as any;
          const sev =
            ev.severity === 'high'
              ? 'border-red-800/80 bg-red-950/30 text-red-200'
              : ev.severity === 'medium'
                ? 'border-amber-800/80 bg-amber-950/30 text-amber-100'
                : 'border-sky-800/80 bg-sky-950/30 text-sky-100';
          return (
            <div className={`rounded-xl border px-4 py-3 text-sm ${sev}`}>
              <p className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5">
                Evento del mundo
              </p>
              <p className="font-bold">{ev.title || ev.type}</p>
              {ev.message && (
                <p className="text-xs opacity-80 mt-1 leading-relaxed">{String(ev.message)}</p>
              )}
            </div>
          );
        })()}

        <nav className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                tab === t.id
                  ? 'bg-amber-600 text-black shadow-lg shadow-amber-900/30'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {t.label}
              {t.id === 'chat' && zonePlayers.length > 0 && (
                <span className="ml-1.5 text-[10px] opacity-80">
                  ({zonePlayers.length})
                </span>
              )}
            </button>
          ))}
        </nav>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {tab === 'map' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <CityMap
                currentLocationId={p.locationId}
                onTravel={handleTravel}
                onRealtimeJoin={joinZone}
              />
            </div>
            <div>
              <ChatPanel
                connected={connected}
                messages={messages}
                worldEvents={worldEvents}
                zonePlayers={zonePlayers}
                onlineTotal={onlineTotal}
                onSendZone={sendZoneChat}
                onSendGlobal={sendGlobalChat}
              />
            </div>
          </div>
        )}
        {tab === 'missions' && <MissionsPanel onReward={handleEconomyChange} />}
        {tab === 'vehicles' && <VehiclesPanel onChange={handleEconomyChange} />}
        {tab === 'properties' && (
          <PropertiesPanel onChange={handleEconomyChange} />
        )}
        {tab === 'progression' && (
          <SkillsBattlePass onChange={handleEconomyChange} />
        )}
        {tab === 'inventory' && (
          <InventoryPanel onChange={handleEconomyChange} />
        )}
        {tab === 'clans' && (
          <ClansPanel onChange={handleEconomyChange} />
        )}
        {tab === 'chat' && (
          <ChatPanel
            connected={connected}
            messages={messages}
            worldEvents={worldEvents}
            zonePlayers={zonePlayers}
            onlineTotal={onlineTotal}
            onSendZone={sendZoneChat}
            onSendGlobal={sendGlobalChat}
          />
        )}

        <footer className="text-center text-zinc-600 text-xs pt-4">
          Mundo libre · Tú decides quién eres · Multiplayer en tiempo real
        </footer>
      </div>
    </main>
  );
}
