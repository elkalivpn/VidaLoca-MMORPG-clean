'use client';

import { useState } from 'react';

export type GallerySceneItem = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  sceneIndex: number;
  location: string;
  weather: string;
  audioFx: string;
  tacticalSummary: string;
  tags18: string[];
  accentBorder: string;
  accentBadge: string;
};

export const GALLERY_SCENES: GallerySceneItem[] = [
  {
    id: 'logo-neon',
    title: 'Identidad Neón & Drift',
    subtitle: 'Logotipo & Arte Oficial · +18',
    image: '/images/vidaloca-logo.png',
    sceneIndex: 4,
    location: 'España · Circuito Clandestino',
    weather: 'Noche Eléctrica · Vapor Neón',
    audioFx: 'Motores V12, derrape en asfalto y sintetizador nocturno',
    tacticalSummary:
      'Sello visual oficial de VidaLoca MMORPG: velocidad extrema, estética urbana sin censura y guerra de clanes bajo luces de neón.',
    tags18: ['+18 Adultos', 'Drift Extremo', 'Bajos Fondos'],
    accentBorder: 'border-amber-500/40',
    accentBadge: 'border-amber-400/50 bg-amber-500/15 text-amber-300',
  },
  {
    id: 'moto-nocturna',
    title: 'Asfalto Nocturno & Moto',
    subtitle: 'Escena Nocturna en Moto · Ruta Clandestina',
    image: '/images/vidaloca-loading.png',
    sceneIndex: 4,
    location: 'Autopista & Callejones Nocturnos',
    weather: 'Madrugada Húmeda · Reflejos Neón',
    audioFx: 'Escape deportivo 1000cc, sirenas lejanas y ráfagas',
    tacticalSummary:
      'Infiltración a 280 km/h entre tráfico pesado, clubes sin censura y tiroteos relámpago donde cada curva decide tu supervivencia.',
    tags18: ['+18 Sin Censura', 'Tiroteos', 'Clubes Nocturnos'],
    accentBorder: 'border-fuchsia-500/40',
    accentBadge: 'border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-300',
  },
  {
    id: 'madrid-gran-via',
    title: 'Tensión Urbana & Lluvia',
    subtitle: 'Madrid · Gran Vía & Centro Financiero',
    image: '/images/madrid-hero.jpg',
    sceneIndex: 0,
    location: 'Gran Vía · Castellana · Sol',
    weather: 'Lluvia Intensa · Asfalto Deslizante',
    audioFx: 'Truenos urbanos, frenazos sobre mojado y radio policial',
    tacticalSummary:
      'Atracos a blindados frente a edificios emblemáticos, enfrentamientos armados con la Policía Nacional y fugas por túneles del centro.',
    tags18: ['+18 Violencia', 'Asaltos', 'Sangre Realista'],
    accentBorder: 'border-amber-500/40',
    accentBadge: 'border-amber-400/50 bg-amber-500/15 text-amber-300',
  },
  {
    id: 'marbella-banus',
    title: 'Clubes VIP, Yates & Casino +18',
    subtitle: 'Marbella · Puerto Banús & Costa del Sol',
    image: '/images/marbella-banus.jpg',
    sceneIndex: 1,
    location: 'Puerto Banús · Clubes Privados',
    weather: 'Noche Cálida · Brisa Marina',
    audioFx: 'Deep house de club VIP, fichas de casino y motores marinos',
    tacticalSummary:
      'Lujo sin límites, mesas clandestinas de póker y ruleta, fiestas privadas para adultos en megayates y ajuste de cuentas en el muelle.',
    tags18: ['+18 Escenas Adultas', 'Casino Ilegal', 'Clubes VIP'],
    accentBorder: 'border-sky-500/40',
    accentBadge: 'border-sky-400/50 bg-sky-500/15 text-sky-300',
  },
  {
    id: 'barcelona-gotico',
    title: 'Tiroteos, Sangre & Persecuciones',
    subtitle: 'Barcelona · Barrio Gótico & Las Ramblas',
    image: '/images/barcelona-chase.jpg',
    sceneIndex: 2,
    location: 'Barrio Gótico · Puerto Olímpico',
    weather: 'Niebla Costera · Iluminación Dramática',
    audioFx: 'Disparos con eco en piedra, cristales rotos y derrapes',
    tacticalSummary:
      'Emboscadas callejeras entre muros medievales, combates cuerpo a cuerpo con heridas visibles y huida táctica en 4x4 o moto.',
    tags18: ['+18 Sangre & Armas', 'Peleas', 'Persecución'],
    accentBorder: 'border-rose-500/40',
    accentBadge: 'border-rose-400/50 bg-rose-500/15 text-rose-300',
  },
  {
    id: 'valencia-flota',
    title: 'Convoyes, Contrabando & Despliegue',
    subtitle: 'Valencia · Ciudad de las Artes & Puerto',
    image: '/images/valencia-fleet.jpg',
    sceneIndex: 3,
    location: 'Puerto de Valencia · Explanada Levante',
    weather: 'Crepúsculo Táctico · Visibilidad Alta',
    audioFx: 'Rotores de helicóptero, camiones pesados y alertas radar',
    tacticalSummary:
      'Operaciones de contrabando a gran escala, interceptación de camiones con mercancía ilícita y extracción aérea bajo fuego cruzado.',
    tags18: ['+18 Contrabando', 'Drogas & Tráfico', 'Combate'],
    accentBorder: 'border-emerald-500/40',
    accentBadge: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300',
  },
];

interface SceneGallerySectionProps {
  activeSceneIndex: number;
  loading: boolean;
  onSelectBackdropScene: (sceneIndex: number) => void;
  onPlayScenePortal: (sceneIndex: number) => void;
  onPlayGuest: () => void;
}

export default function SceneGallerySection({
  activeSceneIndex,
  loading,
  onSelectBackdropScene,
  onPlayScenePortal,
  onPlayGuest,
}: SceneGallerySectionProps) {
  const [selectedId, setSelectedId] = useState<string>(GALLERY_SCENES[1].id);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const selectedIndex = Math.max(
    0,
    GALLERY_SCENES.findIndex((s) => s.id === selectedId),
  );
  const selectedScene = GALLERY_SCENES[selectedIndex] ?? GALLERY_SCENES[0];

  function handlePrev() {
    const prev =
      (selectedIndex - 1 + GALLERY_SCENES.length) % GALLERY_SCENES.length;
    setSelectedId(GALLERY_SCENES[prev].id);
  }

  function handleNext() {
    const next = (selectedIndex + 1) % GALLERY_SCENES.length;
    setSelectedId(GALLERY_SCENES[next].id);
  }

  return (
    <section
      id="escenas"
      className="border-t border-zinc-800/80 bg-zinc-950/90 py-16 backdrop-blur-md"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Section Heading */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-rose-500/60 bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                +18 Realismo
              </span>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                Galería Interactiva · 6 Escenas Oficiales
              </span>
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Escenas del Juego en Vivo — Realismo +18
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Explora cada distrito, activa cualquier atmósfera como fondo
              dinámico en tiempo real o entra directamente a jugar en 3D sin
              censura en Historia en Solitario, Mundo Libre Online 3D o
              Cooperativo y Clanes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              🔍 Abrir Visor Pantalla Completa
            </button>
          </div>
        </div>

        {/* Integrated Tactical Preview Viewer */}
        <div
          className={`mt-8 overflow-hidden rounded-3xl border bg-zinc-900/85 shadow-2xl ${selectedScene.accentBorder}`}
        >
          <div className="grid lg:grid-cols-12">
            <div className="relative min-h-[260px] overflow-hidden bg-zinc-950 lg:col-span-7 lg:min-h-[380px]">
              <img
                src={selectedScene.image}
                alt={`${selectedScene.title} — ${selectedScene.subtitle}`}
                className="h-full w-full object-cover object-center transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-zinc-950/90" />

              <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow">
                  +18
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${selectedScene.accentBadge}`}
                >
                  {selectedScene.subtitle}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="absolute bottom-4 left-4 rounded-xl border border-zinc-700/80 bg-zinc-950/85 px-3 py-1.5 text-[11px] font-bold text-zinc-200 backdrop-blur-md transition hover:border-amber-400 hover:text-amber-300"
              >
                ⤢ Ampliar Escena
              </button>
            </div>

            <div className="flex flex-col justify-between p-6 lg:col-span-5 lg:p-7">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                    Visor Táctico Activo
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Escena anterior"
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-bold text-zinc-300 transition hover:border-amber-400 hover:text-white"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      aria-label="Siguiente escena"
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-bold text-zinc-300 transition hover:border-amber-400 hover:text-white"
                    >
                      →
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-black tracking-tight text-white">
                    {selectedScene.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    {selectedScene.tacticalSummary}
                  </p>
                </div>

                {/* Tactical Telemetry Specs */}
                <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950/75 p-4 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-zinc-400">Zona:</span>
                    <span className="text-right font-bold text-zinc-100">
                      {selectedScene.location}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-zinc-400">Clima:</span>
                    <span className="text-right font-semibold text-sky-300">
                      {selectedScene.weather}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-zinc-400">
                      Audio &amp; FX:
                    </span>
                    <span className="text-right text-amber-300">
                      {selectedScene.audioFx}
                    </span>
                  </div>
                </div>

                {/* +18 Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedScene.tags18.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onSelectBackdropScene(selectedScene.sceneIndex)
                  }
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                    activeSceneIndex === selectedScene.sceneIndex
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-amber-400 hover:text-amber-300'
                  }`}
                >
                  {activeSceneIndex === selectedScene.sceneIndex
                    ? '✓ Activa en Fondo'
                    : 'Activar en Fondo'}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={onPlayGuest}
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-50"
                >
                  ⚡ Jugar esta Escena
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 6 Interactive Scene Cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY_SCENES.map((scene) => {
            const isSelected = scene.id === selectedScene.id;
            const isBackdropActive = activeSceneIndex === scene.sceneIndex;
            return (
              <div
                key={scene.id}
                className={`group flex flex-col justify-between overflow-hidden rounded-2xl border transition ${
                  isSelected
                    ? 'border-amber-400 bg-zinc-900 shadow-xl shadow-amber-500/10'
                    : 'border-zinc-800 bg-zinc-900/65 hover:border-zinc-600'
                }`}
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(scene.id)}
                    className="relative block h-44 w-full overflow-hidden bg-zinc-950 text-left"
                  >
                    <img
                      src={scene.image}
                      alt={scene.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                    <div className="absolute left-3 top-3 flex items-center gap-1.5">
                      <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                        +18
                      </span>
                      {isBackdropActive && (
                        <span className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-black text-zinc-950">
                          Fondo Activo
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                        {scene.subtitle}
                      </p>
                      <h3 className="text-base font-black text-white">
                        {scene.title}
                      </h3>
                    </div>
                  </button>

                  <div className="space-y-2.5 p-4">
                    <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
                      {scene.tacticalSummary}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {scene.tags18.map((tag) => (
                        <span
                          key={tag}
                          className="rounded border border-zinc-700/80 bg-zinc-950/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 border-t border-zinc-800/80 bg-zinc-950/60 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(scene.id);
                      setLightboxOpen(true);
                    }}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-[11px] font-bold text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
                  >
                    Previsualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(scene.id);
                      onSelectBackdropScene(scene.sceneIndex);
                    }}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition ${
                      isBackdropActive
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-amber-400 hover:text-amber-300'
                    }`}
                  >
                    Activar en Fondo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(scene.id);
                      onPlayScenePortal(scene.sceneIndex);
                    }}
                    className="rounded-lg bg-amber-500 px-2 py-2 text-[11px] font-black text-zinc-950 transition hover:bg-amber-400"
                  >
                    Jugar esta Escena
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Visor de escena: ${selectedScene.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 p-4 backdrop-blur-xl"
        >
          <div className="animate-modal-in relative w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
                  +18
                </span>
                <div>
                  <h3 className="text-sm font-black text-white sm:text-base">
                    {selectedScene.title}
                  </h3>
                  <p className="text-[11px] text-amber-300">
                    {selectedScene.subtitle} · {selectedScene.location}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-amber-400 hover:text-white"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="relative bg-zinc-950">
              <img
                src={selectedScene.image}
                alt={selectedScene.title}
                className="max-h-[65vh] w-full object-contain"
              />
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Escena anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-zinc-700 bg-zinc-950/80 px-3.5 py-2 text-sm font-black text-white backdrop-blur transition hover:border-amber-400"
              >
                ←
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Siguiente escena"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-zinc-700 bg-zinc-950/80 px-3.5 py-2 text-sm font-black text-white backdrop-blur transition hover:border-amber-400"
              >
                →
              </button>
            </div>

            <div className="flex flex-col justify-between gap-4 border-t border-zinc-800 p-5 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <p className="text-xs text-zinc-300">
                  {selectedScene.tacticalSummary}
                </p>
                <p className="text-[11px] text-zinc-400">
                  Clima:{' '}
                  <strong className="text-sky-300">
                    {selectedScene.weather}
                  </strong>{' '}
                  · Audio:{' '}
                  <strong className="text-amber-300">
                    {selectedScene.audioFx}
                  </strong>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectBackdropScene(selectedScene.sceneIndex);
                    setLightboxOpen(false);
                  }}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500/25"
                >
                  Activar en Fondo
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setLightboxOpen(false);
                    onPlayGuest();
                  }}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  ⚡ Jugar Ahora en 3D
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
