'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import StreetPlay from '@/components/StreetPlay';
import CityMap from '@/components/CityMap';
import MissionsPanel from '@/components/MissionsPanel';
import InventoryPanel from '@/components/InventoryPanel';
import VehiclesPanel from '@/components/VehiclesPanel';
import PropertiesPanel from '@/components/PropertiesPanel';
import SkillsBattlePass from '@/components/SkillsBattlePass';
import ClansPanel from '@/components/ClansPanel';
import ChatPanel from '@/components/ChatPanel';
import StatsBar from '@/components/StatsBar';
import { useRealtime } from '@/hooks/useRealtime';

type Tab = 'calle' | 'mapa' | 'misiones' | 'inventario' | 'vehiculos' | 'propiedades' | 'skills' | 'clanes';

export default function PlayPage() {
  const router = useRouter();
  const { token, player, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('calle');
  const { connected, messages, sendChat } = useRealtime(token);

  useEffect(() => {
    if (!token) router.replace('/');
  }, [token, router]);

  if (!token || !player) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Cargando…
      </main>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'calle', label: 'Calle' },
    { id: 'mapa', label: 'Mapa' },
    { id: 'misiones', label: 'Misiones' },
    { id: 'inventario', label: 'Inventario' },
    { id: 'vehiculos', label: 'Vehículos' },
    { id: 'propiedades', label: 'Propiedades' },
    { id: 'skills', label: 'Skills / BP' },
    { id: 'clanes', label: 'Clanes' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <StatsBar player={player} connected={connected} onLogout={logout} />
      <nav className="flex flex-wrap gap-1 border-b border-zinc-800 px-2 py-1 bg-zinc-900/80">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === t.id ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] min-h-0">
        <div className="overflow-auto p-3">
          {tab === 'calle' && <StreetPlay />}
          {tab === 'mapa' && <CityMap />}
          {tab === 'misiones' && <MissionsPanel />}
          {tab === 'inventario' && <InventoryPanel />}
          {tab === 'vehiculos' && <VehiclesPanel />}
          {tab === 'propiedades' && <PropertiesPanel />}
          {tab === 'skills' && <SkillsBattlePass />}
          {tab === 'clanes' && <ClansPanel />}
        </div>
        <aside className="border-t lg:border-t-0 lg:border-l border-zinc-800 p-2">
          <ChatPanel messages={messages} onSend={sendChat} />
        </aside>
      </div>
    </div>
  );
}
