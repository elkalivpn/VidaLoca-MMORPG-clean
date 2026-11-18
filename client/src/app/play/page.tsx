'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { CITIES } from '@/data/cities';
import StreetPlay from '@/components/StreetPlay';
import CityMap from '@/components/CityMap';
import MissionsPanel from '@/components/MissionsPanel';
import InventoryPanel from '@/components/InventoryPanel';
import { VehiclesPanel } from '@/components/VehiclesPanel';
import PropertiesPanel from '@/components/PropertiesPanel';
import SkillsBattlePass from '@/components/SkillsBattlePass';
import ClansPanel from '@/components/ClansPanel';
import FactionsPanel from '@/components/FactionsPanel';
import HeistsMarketPanel from '@/components/HeistsMarketPanel';
import EngagementPanel from '@/components/EngagementPanel';
import MarketplacePanel from '@/components/MarketplacePanel';
import ChatPanel from '@/components/ChatPanel';
import StatsBar from '@/components/StatsBar';
import LoadingScreen from '@/components/LoadingScreen';
import CasinoPanel from '@/components/CasinoPanel';
import PanelErrorBoundary from '@/components/PanelErrorBoundary';
import { useRealtime } from '@/hooks/useRealtime';

type Tab =
  | 'calle'
  | 'mapa'
  | 'casino'
  | 'diario'
  | 'misiones'
  | 'mercado'
  | 'inventario'
  | 'vehiculos'
  | 'propiedades'
  | 'skills'
  | 'clanes'
  | 'facciones'
  | 'golpes';

const TUTORIAL_KEY = 'vidaloca_tutorial_dismissed';

export default function PlayPage() {
  const router = useRouter();
  const { token, player, refreshPlayer, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('calle');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertEmail, setConvertEmail] = useState('');
  const [convertUsername, setConvertUsername] = useState('');
  const [convertPassword, setConvertPassword] = useState('');
  const [convertMsg, setConvertMsg] = useState('');
  const [converting, setConverting] = useState(false);
  const lastLocationIdRef = useRef<string | null>(null);
  const [transitionOverlay, setTransitionOverlay] = useState<{
    visible: boolean;
    subtitle: string;
    zoneName: string;
  }>({
    visible: false,
    subtitle: '',
    zoneName: '',
  });

  const {
    connected,
    playerId,
    messages,
    pursuitAlerts,
    remotePlayersRef,
    combatShotsRef,
    subscribeCombatShot,
    subscribeCombatDamaged,
    sendZoneChat,
    sendGlobalChat,
    joinZone,
    emitMove,
  } = useRealtime(Boolean(token));

  useEffect(() => {
    if (!token) router.replace('/');
  }, [token, router]);

  useEffect(() => {
    if (token && !player) {
      void refreshPlayer();
    }
  }, [token, player, refreshPlayer]);

  useEffect(() => {
    const locId = player?.locationId;
    if (!locId) return;
    const prevLocId = lastLocationIdRef.current;
    if (prevLocId === locId) return;
    lastLocationIdRef.current = locId;
    const cityMeta = CITIES.find((c) => c.id === locId);
    const zoneLabel = cityMeta ? `${cityMeta.city} · ${cityMeta.name}` : locId;
    setTransitionOverlay({
      visible: true,
      zoneName: zoneLabel,
      subtitle:
        prevLocId === null
          ? `Entrando a ${zoneLabel}…`
          : `Viajando a ${zoneLabel}…`,
    });
    const timer = window.setTimeout(() => {
      setTransitionOverlay((prev) => ({ ...prev, visible: false }));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [player?.locationId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowTutorial(localStorage.getItem(TUTORIAL_KEY) !== '1');
    }
  }, []);

  function dismissTutorial() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TUTORIAL_KEY, '1');
    }
    setShowTutorial(false);
  }

  async function handleConvertGuest(e: React.FormEvent) {
    e.preventDefault();
    setConvertMsg('');
    setConverting(true);
    try {
      await api.convertGuest({
        email: convertEmail.trim(),
        username: convertUsername.trim(),
        password: convertPassword,
        displayName: convertUsername.trim(),
      });
      setConvertMsg('¡Cuenta guardada! Has recibido tu bono de bienvenida.');
      setShowConvertModal(false);
      await refreshPlayer();
    } catch (err: unknown) {
      setConvertMsg(
        err instanceof Error ? err.message : 'Error al guardar la cuenta',
      );
    } finally {
      setConverting(false);
    }
  }

  if (!token || !player) {
    return <LoadingScreen />;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'calle', label: 'Calle' },
    { id: 'mapa', label: 'Mapa' },
    { id: 'casino', label: '🎰 Casino +18' },
    { id: 'diario', label: 'Diario / Top' },
    { id: 'misiones', label: 'Misiones' },
    { id: 'mercado', label: 'Mercado P2P / VIP' },
    { id: 'inventario', label: 'Inventario' },
    { id: 'vehiculos', label: 'Vehículos' },
    { id: 'propiedades', label: 'Propiedades' },
    { id: 'skills', label: 'Skills / BP' },
    { id: 'clanes', label: 'Clanes' },
    { id: 'facciones', label: 'Facciones' },
    { id: 'golpes', label: 'Golpes / Mercado' },
  ];

  const isGuest = Boolean(player.user?.isGuest);
  const currentTabLabel = tabs.find((t) => t.id === tab)?.label ?? 'Calle';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {transitionOverlay.visible && (
        <LoadingScreen
          compact
          subtitle={transitionOverlay.subtitle}
          zoneName={transitionOverlay.zoneName}
        />
      )}
      <StatsBar player={player} connected={connected} onLogout={logout} />

      {isGuest && (
        <div className="border-b border-sky-500/30 bg-sky-950/40 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="text-sky-200">
            Estás jugando como <strong>Invitado</strong>. Guarda tu progreso con
            correo y contraseña para recibir un bono extra de{' '}
            <strong className="text-amber-300">+500 € y +10 VC</strong> (o
            +2.000 € / +25 VC si vienes invitado).
          </div>
          <button
            type="button"
            onClick={() => setShowConvertModal((v) => !v)}
            className="rounded-md bg-sky-400 px-3 py-1 font-bold text-zinc-950 hover:bg-sky-300"
          >
            {showConvertModal ? 'Cerrar' : 'Guardar Cuenta Gratis'}
          </button>
        </div>
      )}

      {convertMsg && (!isGuest || !showConvertModal) && (
        <div className="border-b border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-xs flex items-center justify-between gap-2 text-emerald-200">
          <span>{convertMsg}</span>
          <button
            type="button"
            onClick={() => setConvertMsg('')}
            className="text-emerald-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {isGuest && showConvertModal && (
        <form
          onSubmit={(e) => {
            void handleConvertGuest(e);
          }}
          className="border-b border-sky-500/30 bg-zinc-900/95 px-4 py-3 flex flex-wrap items-end gap-2 text-xs"
        >
          <div>
            <label className="mb-1 block text-[11px] text-zinc-400">
              Correo
            </label>
            <input
              type="email"
              required
              value={convertEmail}
              onChange={(e) => setConvertEmail(e.target.value)}
              placeholder="tu@correo.es"
              className="rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-400">
              Nombre en la calle
            </label>
            <input
              required
              minLength={3}
              value={convertUsername}
              onChange={(e) => setConvertUsername(e.target.value)}
              placeholder="TuAlias"
              className="rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-400">
              Contraseña (mín. 8, letra y número)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={convertPassword}
              onChange={(e) => setConvertPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={converting}
            className="rounded bg-amber-500 px-3 py-1.5 font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {converting ? 'Guardando…' : 'Confirmar y Reclamar Bono'}
          </button>
          {convertMsg && <span className="text-amber-300">{convertMsg}</span>}
        </form>
      )}

      {showTutorial && (
        <div className="border-b border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-zinc-200">
            <span className="font-bold text-amber-300">Primeros pasos:</span>
            <button
              type="button"
              onClick={() => setTab('diario')}
              className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-200 hover:bg-amber-500/20"
            >
              1. Reclama tu Racha Diaria
            </button>
            <button
              type="button"
              onClick={() => setTab('calle')}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 hover:border-zinc-500"
            >
              2. Haz una acción en la Calle 3D
            </button>
            <button
              type="button"
              onClick={() => setTab('misiones')}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 hover:border-zinc-500"
            >
              3. Acepta una Misión
            </button>
            <button
              type="button"
              onClick={() => setTab('mercado')}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 hover:border-zinc-500"
            >
              4. Visita el Mercado P2P / VIP
            </button>
          </div>
          <button
            type="button"
            onClick={dismissTutorial}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Ocultar ✕
          </button>
        </div>
      )}

      {/* Desktop 13-tab navigation bar */}
      <nav className="hidden md:flex flex-wrap gap-1 border-b border-zinc-800 px-2 py-1 bg-zinc-900/80">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === t.id
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Mobile compact section switcher for remaining tabs (bottom bar handles primary 6) */}
      <div className="md:hidden relative border-b border-zinc-800 bg-zinc-900/85 px-3 py-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-amber-300 truncate">
          Sección: {currentTabLabel}
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-zinc-200"
        >
          {mobileMenuOpen ? 'Cerrar ✕' : 'Más secciones ▾'}
        </button>
        {mobileMenuOpen && (
          <div className="absolute left-2 right-2 top-full mt-1 z-40 grid grid-cols-2 gap-1 rounded-xl border border-zinc-700 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-md">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setMobileMenuOpen(false);
                }}
                className={`rounded-lg px-2.5 py-2 text-left text-xs font-medium ${
                  tab === t.id
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] min-h-0 pb-14 md:pb-0">
        <div className="overflow-auto p-3 min-w-0">
          <PanelErrorBoundary panelKey={tab}>
            {tab === 'calle' && (
              <StreetPlay
                remotePlayersRef={remotePlayersRef}
                remoteShotsRef={combatShotsRef}
                onSubscribeCombatShot={subscribeCombatShot}
                onSubscribeCombatDamaged={subscribeCombatDamaged}
                onChanged={() => {
                  void refreshPlayer();
                }}
                emitMove={emitMove}
                connected={connected}
                localPlayerId={playerId || player.id}
                onNavigateTab={(t) => setTab(t)}
              />
            )}
            {tab === 'mapa' && (
              <CityMap
                onZoneChanged={(z) => {
                  void joinZone(z);
                }}
              />
            )}
            {tab === 'casino' && <CasinoPanel />}
            {tab === 'diario' && <EngagementPanel />}
            {tab === 'misiones' && <MissionsPanel />}
            {tab === 'mercado' && <MarketplacePanel />}
            {tab === 'inventario' && <InventoryPanel />}
            {tab === 'vehiculos' && <VehiclesPanel />}
            {tab === 'propiedades' && <PropertiesPanel />}
            {tab === 'skills' && <SkillsBattlePass />}
            {tab === 'clanes' && <ClansPanel />}
            {tab === 'facciones' && (
              <FactionsPanel pursuitAlerts={pursuitAlerts} />
            )}
            {tab === 'golpes' && <HeistsMarketPanel />}
          </PanelErrorBoundary>
        </div>
        <aside className="min-w-0 border-t lg:border-t-0 lg:border-l border-zinc-800 p-2">
          <ChatPanel
            messages={messages}
            connected={connected}
            onSend={(text, scope) =>
              scope === 'global' ? sendGlobalChat(text) : sendZoneChat(text)
            }
          />
        </aside>
      </div>

      {/* Mobile Bottom Quick-Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-6 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        {(
          [
            { id: 'calle', label: 'Calle', icon: '🏙️' },
            { id: 'mapa', label: 'Mapa', icon: '🗺️' },
            { id: 'casino', label: 'Casino', icon: '🎰' },
            { id: 'diario', label: 'Eventos', icon: '🔥' },
            { id: 'misiones', label: 'Misiones', icon: '🎯' },
            { id: 'mercado', label: 'VIP/P2P', icon: '👑' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setMobileMenuOpen(false);
            }}
            className={`flex flex-col items-center justify-center py-1.5 text-[10px] font-semibold ${
              tab === item.id ? 'text-amber-300' : 'text-zinc-400'
            }`}
          >
            <span className="text-sm leading-none">{item.icon}</span>
            <span className="mt-0.5">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
