'use client';

import { useEffect, useState } from 'react';

type LoadingScene = {
  id: string;
  label: string;
  image: string;
  clip: string;
};

const LOADING_SCENES: LoadingScene[] = [
  {
    id: 'vidaloca-loading',
    label: 'Ruta Clandestina · Noche +18',
    image: '/images/vidaloca-loading.png',
    clip: '/clips/vidaloca-loading.mp4',
  },
  {
    id: 'madrid-hero',
    label: 'Madrid · Gran Vía & Centro',
    image: '/images/madrid-hero.jpg',
    clip: '/clips/madrid-hero.mp4',
  },
  {
    id: 'marbella-banus',
    label: 'Marbella · Puerto Banús VIP',
    image: '/images/marbella-banus.jpg',
    clip: '/clips/marbella-banus.mp4',
  },
  {
    id: 'barcelona-chase',
    label: 'Barcelona · Barrio Gótico',
    image: '/images/barcelona-chase.jpg',
    clip: '/clips/barcelona-chase.mp4',
  },
  {
    id: 'valencia-fleet',
    label: 'Valencia · Puerto & Flota',
    image: '/images/valencia-fleet.jpg',
    clip: '/clips/valencia-fleet.mp4',
  },
];

const DISTRICT_PHRASES = [
  'Sincronizando cámaras de tráfico y patrullas del distrito…',
  'Calibrando neumáticos, trazadoras y telemetría nocturna…',
  'Conectando con mesas clandestinas +18 y mercados negros…',
  'Cargando iluminación volumétrica, lluvia y radar táctico…',
  'Estableciendo enlace cifrado con la red en tiempo real…',
];

const TACTICAL_TIPS = [
  'Pulsa [F] en la calle para sacar o guardar tu vehículo al instante.',
  'Mantén [Espacio] al girar para derrapar y encadenar un Combo de Drift.',
  'Pulsa [Q] para disparar o [V] para pelear cuerpo a cuerpo en PvP.',
  'Mantén [Shift] al conducir para activar el Turbo con llamas de escape.',
  'Pulsa [E] frente a las balizas iluminadas para acceder a Movidas y Garaje.',
  'Visita la pestaña 🎰 Casino +18 para probar suerte en Ruleta, Blackjack y Dados.',
];

function resolveInitialSceneIndex(zoneName?: string): number {
  if (!zoneName) return 0;
  const lower = zoneName.toLowerCase();
  if (lower.includes('madrid')) return 1;
  if (lower.includes('marbella') || lower.includes('banús')) return 2;
  if (lower.includes('barcelona') || lower.includes('ramblas')) return 3;
  if (lower.includes('valencia')) return 4;
  return 0;
}

export interface LoadingScreenProps {
  subtitle?: string;
  progress?: number;
  compact?: boolean;
  zoneName?: string;
}

export default function LoadingScreen({
  subtitle,
  progress,
  compact = false,
  zoneName,
}: LoadingScreenProps) {
  const [autoProgress, setAutoProgress] = useState(compact ? 32 : 14);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(() =>
    resolveInitialSceneIndex(zoneName),
  );
  const [failedClips, setFailedClips] = useState<Record<string, boolean>>({});
  const [readyClips, setReadyClips] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (zoneName) {
      setSceneIndex(resolveInitialSceneIndex(zoneName));
    }
  }, [zoneName]);

  useEffect(() => {
    setAutoProgress(compact ? 32 : 14);

    const pTimer = setInterval(
      () => {
        setAutoProgress((prev) => {
          const cap = compact ? 99 : 94;
          if (prev >= cap) return cap;
          const step = compact ? 14 : prev < 50 ? 9 : prev < 80 ? 5 : 2;
          return Math.min(cap, prev + step);
        });
      },
      compact ? 95 : 220,
    );

    const textTimer = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % DISTRICT_PHRASES.length);
      setTipIndex((prev) => (prev + 1) % TACTICAL_TIPS.length);
    }, 2400);

    const sceneTimer = setInterval(
      () => {
        setSceneIndex((prev) => (prev + 1) % LOADING_SCENES.length);
      },
      compact ? 1800 : 3400,
    );

    return () => {
      clearInterval(pTimer);
      clearInterval(textTimer);
      clearInterval(sceneTimer);
    };
  }, [compact]);

  const displayProgress = Math.min(100, Math.max(4, progress ?? autoProgress));
  const activeScene = LOADING_SCENES[sceneIndex] ?? LOADING_SCENES[0];

  const containerClass = compact
    ? 'fixed inset-0 z-50 w-full overflow-hidden bg-zinc-950/95 text-zinc-100 flex flex-col items-center justify-between px-4 py-6 select-none backdrop-blur-md animate-modal-in'
    : 'relative min-h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100 flex flex-col items-center justify-between px-4 py-8 select-none';

  return (
    <main
      className={containerClass}
      role={compact ? 'status' : undefined}
      aria-live={compact ? 'polite' : undefined}
    >
      {/* Rotating Multi-Scene Cinematic Backdrop (Clips with Ken Burns Image Fallback) */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {LOADING_SCENES.map((scene, idx) => {
          const isActive = idx === sceneIndex;
          const clipFailed = Boolean(failedClips[scene.id]);
          const clipReady = Boolean(readyClips[scene.id]);
          return (
            <div
              key={scene.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={scene.image}
                alt={scene.label}
                className={`h-full w-full object-cover object-center ${
                  isActive ? 'animate-kenburns' : 'scale-100'
                }`}
              />
              {!clipFailed && isActive && (
                <video
                  key={scene.clip}
                  src={scene.clip}
                  poster={scene.image}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onCanPlay={() => {
                    setReadyClips((prev) =>
                      prev[scene.id] ? prev : { ...prev, [scene.id]: true },
                    );
                  }}
                  onError={() => {
                    setFailedClips((prev) =>
                      prev[scene.id] ? prev : { ...prev, [scene.id]: true },
                    );
                  }}
                  className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${
                    clipReady ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div
        className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/60"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_15%,rgba(9,9,11,0.92)_90%)]"
        aria-hidden="true"
      />

      {/* Top Classification Header */}
      <div className="relative z-10 flex w-full max-w-4xl items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-950/80 px-3 py-1 text-[11px] font-semibold tracking-wider text-zinc-300 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="truncate">
            {zoneName
              ? `DESTINO · ${zoneName.toUpperCase()}`
              : activeScene.label.toUpperCase()}
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-500/60 bg-rose-950/75 px-3 py-1 text-xs font-black tracking-widest text-rose-300 shadow-lg shadow-rose-950/50 backdrop-blur-md">
          <span>+18</span>
          <span className="text-[10px] font-semibold text-rose-200/80">
            FICCIÓN ADULTA
          </span>
        </span>
      </div>

      {/* Center Logo & Ambient Glow */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto max-w-xl">
        <div className="relative">
          <div className="absolute -inset-6 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
          <img
            src="/images/vidaloca-logo.png"
            alt="VidaLoca MMORPG"
            className={`relative w-auto object-contain drop-shadow-[0_10px_30px_rgba(245,158,11,0.45)] ${
              compact ? 'h-20 sm:h-28' : 'h-28 sm:h-36'
            }`}
          />
        </div>
        <p className="mt-3 text-xs sm:text-sm uppercase tracking-[0.26em] text-amber-300/90 font-bold">
          {compact
            ? 'Transición de Distrito · Tiempo Real'
            : 'Motor Sensorial 3D · Mundo Persistente'}
        </p>
      </div>

      {/* Bottom Progress & Tactical Briefing */}
      <div className="relative z-10 w-full max-w-2xl space-y-3">
        <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/85 p-4 sm:p-5 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between gap-2 text-xs mb-2">
            <span className="font-semibold text-zinc-200 truncate">
              {subtitle || DISTRICT_PHRASES[phraseIndex]}
            </span>
            <span className="font-black tabular-nums text-amber-400">
              {Math.round(displayProgress)}%
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500 transition-all duration-150 shadow-[0_0_16px_rgba(245,158,11,0.65)]"
              style={{ width: `${displayProgress}%` }}
            />
          </div>

          {!compact && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-zinc-300">
              <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                Consejo
              </span>
              <span className="leading-relaxed">{TACTICAL_TIPS[tipIndex]}</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
