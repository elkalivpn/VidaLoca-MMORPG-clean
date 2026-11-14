'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import CinematicBackdrop, {
  CINEMATIC_SCENES,
} from '@/components/CinematicBackdrop';

import type { Player } from '@/types/game';

type AuthResult = {
  accessToken: string;
  user?: { player?: Player | null; username?: string };
};

type CityCard = {
  id: string;
  name: string;
  zone: string;
  image: string;
  badge: string;
  heat: string;
  economy: string;
  description: string;
  sceneIndex: number;
};

const CITIES: CityCard[] = [
  {
    id: 'madrid',
    name: 'Madrid & Centro',
    zone: 'Gran Vía · Toledo · Valladolid · Zaragoza',
    image: '/images/madrid-hero.jpg',
    badge: 'Capital & Meseta',
    heat: 'Alto',
    economy: 'Banca & Logística',
    description:
      'Desde la Gran Vía madrileña hasta las murallas de Toledo, Valladolid, Salamanca y el corredor de Zaragoza.',
    sceneIndex: 0,
  },
  {
    id: 'galicia',
    name: 'Galicia',
    zone: 'A Coruña · Santiago · Ría de Vigo',
    image: '/images/barcelona-chase.jpg',
    badge: 'Atlántico · Rías',
    heat: 'Alto',
    economy: 'Astilleros & Navieras',
    description:
      'Planeadoras nocturnas por la Ría de Vigo, puertos atlánticos en A Coruña y pactos bajo la lluvia de Santiago.',
    sceneIndex: 2,
  },
  {
    id: 'pais_vasco',
    name: 'País Vasco',
    zone: 'Bilbao · San Sebastián · Vitoria',
    image: '/images/madrid-hero.jpg',
    badge: 'Norte · Cantábrico',
    heat: 'Controlado',
    economy: 'Banca & Blindaje',
    description:
      'El distrito financiero de Abando, la bahía VIP de La Concha y plataformas industriales en Vitoria-Gasteiz.',
    sceneIndex: 0,
  },
  {
    id: 'baleares',
    name: 'Islas Baleares',
    zone: 'Palma de Mallorca · Ibiza',
    image: '/images/marbella-banus.jpg',
    badge: 'Mediterráneo · VIP',
    heat: 'Medio',
    economy: 'Megayates & Clubes',
    description:
      'Capital offshore en el Paseo Marítimo de Palma y noches interminables entre Dalt Vila y Marina Botafoch.',
    sceneIndex: 1,
  },
  {
    id: 'canarias',
    name: 'Islas Canarias',
    zone: 'Las Palmas · Santa Cruz de Tenerife',
    image: '/images/valencia-fleet.jpg',
    badge: 'Atlántico · Zona Franca',
    heat: 'Táctico',
    economy: 'Puertos & Puente Aéreo',
    description:
      'Puente tricontinental en Puerto de La Luz y rutas volcánicas bajo el Teide conectadas por mar y aire.',
    sceneIndex: 3,
  },
  {
    id: 'marbella',
    name: 'Marbella & Andalucía',
    zone: 'Puerto Banús · Sevilla Triana',
    image: '/images/marbella-banus.jpg',
    badge: 'Sur · Costa del Sol',
    heat: 'Medio',
    economy: 'Yates & Gremios',
    description:
      'Superdeportivos en Puerto Banús y control territorial tradicional en el Casco Antiguo de Sevilla.',
    sceneIndex: 1,
  },
  {
    id: 'barcelona_valencia',
    name: 'Arco Mediterráneo',
    zone: 'Barcelona Ramblas · Valencia Artes',
    image: '/images/barcelona-chase.jpg',
    badge: 'Levante · Puertos',
    heat: 'Muy Alto',
    economy: 'Contrabando & Flota',
    description:
      'Persecuciones por el Barrio Gótico y grandes explanadas de logística aérea en la Ciudad de las Artes.',
    sceneIndex: 2,
  },
];

const FLEET_CATEGORIES = [
  {
    name: 'Deportivos',
    spec: '240 km/h · Tracción trasera',
    desc: 'Equilibrio perfecto entre agilidad urbana y derrapes controlados en curva.',
    tag: 'Calle',
  },
  {
    name: 'Superdeportivos',
    spec: '330+ km/h · Biplaza V10/V12',
    desc: 'Aceleración brutal, aerodinámica activa y respuesta instantánea al freno de mano.',
    tag: 'Élite',
  },
  {
    name: 'Motos',
    spec: '280 km/h · Paso estrecho',
    desc: 'Filtra el tráfico denso de Las Ramblas y desaparece por callejones imposibles.',
    tag: 'Ágil',
  },
  {
    name: 'Quads',
    spec: 'Todo terreno · 4WD',
    desc: 'Estabilidad extrema en aceras, muelles, rampas y pistas de tierra.',
    tag: 'Off-Road',
  },
  {
    name: '4x4',
    spec: 'Chasis reforzado · Interceptación',
    desc: 'Vehículos pesados de patrulla o asalto capaces de abrirse paso ante bloqueos.',
    tag: 'Táctico',
  },
  {
    name: 'Camiones',
    spec: 'Carga pesada · Convoy',
    desc: 'Transporte logístico de mercancía legal o contrabando a gran escala entre ciudades.',
    tag: 'Logística',
  },
  {
    name: 'Ambulancias',
    spec: 'Emergencias · Prioridad',
    desc: 'Unidades médicas de respuesta rápida con sirenas activas y cobertura de facción.',
    tag: 'Servicio',
  },
  {
    name: 'Helicópteros',
    spec: 'Despliegue aéreo · Vigilancia',
    desc: 'Extracciones en azoteas, patrullaje nocturno y reconocimiento desde el cielo.',
    tag: 'Aire',
  },
  {
    name: 'Aviones',
    spec: 'Largo alcance · Pista',
    desc: 'Conexión rápida entre costas, rutas privadas y envíos de alto valor.',
    tag: 'Aire+',
  },
];

const FACTIONS = [
  {
    name: 'Policía Nacional',
    role: 'Orden Urbano & Patrulla',
    accent: 'border-sky-500/40 bg-sky-950/20',
    badge: 'text-sky-300 bg-sky-500/15 border-sky-500/30',
    desc: 'Despliega unidades 4x4, controla el nivel de calor en los distritos y neutraliza golpes en curso.',
    perks: [
      'Sirenas y prioridad de paso',
      'Radar táctico ampliado',
      'Bonos por detenciones',
    ],
  },
  {
    name: 'Guardia Civil',
    role: 'Interceptación & Operaciones',
    accent: 'border-emerald-500/40 bg-emerald-950/20',
    badge: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
    desc: 'Especialistas en autopistas, puertos y espacio aéreo con helicópteros tácticos y controles de carretera.',
    perks: [
      'Unidades aéreas de apoyo',
      'Control de rutas interurbanas',
      'Armamento de precisión',
    ],
  },
  {
    name: 'Sindicato',
    role: 'Calle, Golpes & Mercado Negro',
    accent: 'border-rose-500/40 bg-rose-950/20',
    badge: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
    desc: 'Domina los bajos fondos, coordina atracos relámpago y controla las rutas nocturnas de escape.',
    perks: [
      'Acceso a garajes clandestinos',
      'Contratos de alto riesgo',
      'Red de pisos francos',
    ],
  },
  {
    name: 'Gremio Empresarial',
    role: 'Imperio Inmobiliario & Flotas',
    accent: 'border-amber-500/40 bg-amber-950/20',
    badge: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
    desc: 'Construye riqueza legal o gris con propiedades, locales nocturnos, concesionarios y flotas corporativas.',
    perks: [
      'Ingresos pasivos por distrito',
      'Descuentos en propiedades',
      'Blindaje VIP y escolta',
    ],
  },
];

const RELEASES_URL =
  'https://github.com/elkalivpn/VidaLoca-MMORPG-clean/releases/latest';

const GAME_MODES = [
  {
    title: 'Modo Historia Offline',
    badge: 'Un Jugador',
    accent: 'border-amber-500/35 bg-amber-500/10 text-amber-300',
    desc: 'Recorre las ciudades de España en solitario con misiones, tráfico y progresión local sin conexión.',
  },
  {
    title: 'Red Local LAN',
    badge: 'Cooperativo / PvP',
    accent: 'border-sky-500/35 bg-sky-500/10 text-sky-300',
    desc: 'Crea o únete a salas en tu misma red Wi‑Fi o Ethernet con latencia mínima junto a tus amigos.',
  },
  {
    title: 'Online MMO',
    badge: 'Servidor Persistente',
    accent: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
    desc: 'Mundo abierto compartido 24/7 con facciones, economía real, flotas y persecuciones en vivo.',
  },
];

const DOWNLOAD_PLATFORMS = [
  {
    id: 'windows',
    name: 'Windows',
    format: '.exe',
    category: 'PC · Escritorio',
    requirement: 'Windows 10 / 11 (64-bit)',
    detail: 'Instalador nativo Godot 4 con soporte Vulkan y DirectX.',
    cta: 'Descargar .exe',
    accent: 'hover:border-sky-400/60',
    badgeClass: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
  },
  {
    id: 'macos',
    name: 'macOS',
    format: '.dmg',
    category: 'PC · Mac',
    requirement: 'macOS 12+ (Apple Silicon & Intel)',
    detail: 'Imagen universal optimizada con motor gráfico Metal.',
    cta: 'Descargar .dmg',
    accent: 'hover:border-zinc-400/60',
    badgeClass: 'border-zinc-500/30 bg-zinc-500/15 text-zinc-200',
  },
  {
    id: 'linux',
    name: 'Linux',
    format: '.AppImage',
    category: 'PC · Portable',
    requirement: 'Distros x86_64 con Vulkan / OpenGL',
    detail: 'Ejecutable portable sin instalación para escritorios Linux.',
    cta: 'Descargar .AppImage',
    accent: 'hover:border-amber-400/60',
    badgeClass: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  },
  {
    id: 'android',
    name: 'Android',
    format: '.apk',
    category: 'Móvil · Tablet',
    requirement: 'Android 9.0+ (ARM64)',
    detail: 'Controles táctiles adaptativos y compatibilidad con mando.',
    cta: 'Descargar .apk',
    accent: 'hover:border-emerald-400/60',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  },
  {
    id: 'ios',
    name: 'iOS',
    format: 'iPhone & iPad',
    category: 'Móvil · Apple',
    requirement: 'iOS / iPadOS 15+',
    detail: 'Paquete oficial para dispositivos Apple desde Releases.',
    cta: 'Ver en Releases',
    accent: 'hover:border-rose-400/60',
    badgeClass: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  },
];

export default function HomePage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selectedCityId, setSelectedCityId] = useState<string>('madrid');

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const activeScene = CINEMATIC_SCENES[sceneIndex] ?? CINEMATIC_SCENES[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = (
        mode === 'login'
          ? await api.login({ email, password })
          : await api.register({
              email,
              username,
              password,
              displayName: username,
            })
      ) as AuthResult;
      const player = data.user?.player ?? null;
      setAuth(data.accessToken, player);
      router.push('/play');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  }

  function focusPortal(nextMode?: 'login' | 'register') {
    if (nextMode) setMode(nextMode);
    document.getElementById('portal')?.scrollIntoView({ behavior: 'smooth' });
    window.setTimeout(() => {
      emailInputRef.current?.focus();
    }, 350);
  }

  return (
    <div className="relative min-h-screen text-zinc-100 selection:bg-amber-500 selection:text-zinc-950">
      <CinematicBackdrop
        activeIndex={sceneIndex}
        onIndexChange={setSceneIndex}
      />

      {/* Top Navigation */}
      <header className="relative z-20 border-b border-zinc-800/60 bg-zinc-950/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 font-black text-zinc-950 shadow-lg shadow-amber-500/20">
              V
            </div>
            <div>
              <span className="text-base font-black tracking-wider text-zinc-100">
                VIDALOCA
              </span>
              <span className="ml-2 hidden rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300 sm:inline-block">
                MMORPG
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-wider text-zinc-300 md:flex">
            <a
              href="#descargas"
              className="text-amber-300 transition hover:text-amber-200"
            >
              Descargas
            </a>
            <a href="#ciudades" className="transition hover:text-amber-400">
              Ciudades
            </a>
            <a href="#flota" className="transition hover:text-amber-400">
              Flota &amp; Drift
            </a>
            <a href="#facciones" className="transition hover:text-amber-400">
              Facciones
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              España · En Vivo
            </span>
          </div>
        </div>
      </header>

      {/* HERO + GLASSMORPHIC PORTAL ABOVE THE FOLD */}
      <main className="relative z-10">
        <section
          id="portal"
          className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:min-h-[calc(100vh-64px)] lg:grid-cols-12 lg:py-12"
        >
          {/* Left Hero Copy & Scene Selector */}
          <div className="space-y-6 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-300">
                Mundo Libre en Vivo
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-[11px] font-medium text-zinc-300">
                Conducción &amp; Derrape 3D
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-[11px] font-medium text-zinc-300">
                Economía Real &amp; Facciones
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                VIDALOCA —{' '}
                <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                  España es tuya
                </span>
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                Domina el asfalto de Gran Vía, cierra tratos en Puerto Banús o
                lidera persecuciones en Barcelona. Sube a tu superdeportivo,
                quema rueda con físicas de derrape y construye tu imperio en un
                mundo abierto persistente.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="#descargas"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/25 transition hover:from-amber-300 hover:to-amber-400"
                >
                  <span>Descargar Cliente Nativo</span>
                  <span aria-hidden="true">↓</span>
                </a>
                <span className="rounded-xl border border-zinc-800 bg-zinc-950/75 px-3.5 py-2.5 text-xs font-semibold text-zinc-300 backdrop-blur-sm">
                  Godot 4 · Offline · LAN · Online MMO
                </span>
              </div>
            </div>

            {/* Scene Selector */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/65 p-4 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    Escena Activa · {activeScene.district}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-300">
                    {activeScene.tagline}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CINEMATIC_SCENES.map((sc, idx) => {
                  const active = idx === sceneIndex;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSceneIndex(idx)}
                      className={`group flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow-lg shadow-amber-500/10'
                          : 'border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                      }`}
                    >
                      <span>{sc.city}</span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          active ? 'bg-amber-400' : 'bg-zinc-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 pt-1 sm:max-w-lg">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3 py-2.5 backdrop-blur-sm">
                <p className="text-lg font-black text-amber-400">6</p>
                <p className="text-[11px] text-zinc-400">Ciudades Vivas</p>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3 py-2.5 backdrop-blur-sm">
                <p className="text-lg font-black text-sky-400">9</p>
                <p className="text-[11px] text-zinc-400">Clases de Flota</p>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3 py-2.5 backdrop-blur-sm">
                <p className="text-lg font-black text-emerald-400">4</p>
                <p className="text-[11px] text-zinc-400">Facciones Activas</p>
              </div>
            </div>
          </div>

          {/* Right Column: Glassmorphic Auth Portal */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/80 p-6 shadow-2xl shadow-black/80 backdrop-blur-xl sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    Acceso al Servidor
                  </p>
                  <h2 className="mt-0.5 text-2xl font-black tracking-tight text-white">
                    {mode === 'login'
                      ? 'Entrar al Distrito'
                      : 'Crear Personaje'}
                  </h2>
                </div>
                <span className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
                  3D + Mapa
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`rounded-lg py-2 transition ${
                    mode === 'login'
                      ? 'bg-amber-500 text-zinc-950 shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`rounded-lg py-2 transition ${
                    mode === 'register'
                      ? 'bg-amber-500 text-zinc-950 shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Crear Cuenta
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  void submit(e);
                }}
                className="mt-5 space-y-3.5"
              >
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                    Correo electrónico
                  </label>
                  <input
                    ref={emailInputRef}
                    type="email"
                    className="w-full rounded-xl border border-zinc-700/90 bg-zinc-900/90 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400"
                    placeholder="jugador@vidaloca.es"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                      Nombre en la calle
                    </label>
                    <input
                      className="w-full rounded-xl border border-zinc-700/90 bg-zinc-900/90 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400"
                      placeholder="Ej. ElHalconMadrid"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-zinc-700/90 bg-zinc-900/90 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      mode === 'login' ? 'current-password' : 'new-password'
                    }
                    required
                  />
                </div>

                {error && (
                  <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 text-sm font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/25 transition hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
                >
                  {loading
                    ? 'Conectando al servidor…'
                    : mode === 'login'
                      ? 'Entrar a España'
                      : 'Crear Cuenta y Jugar'}
                </button>
              </form>

              <p className="mt-4 text-center text-[11px] text-zinc-400">
                Controles 3D: <span className="text-zinc-200">WASD</span> mover
                · <span className="text-amber-300">[F]</span> vehículo ·{' '}
                <span className="text-sky-300">[Espacio]</span> drift ·{' '}
                <span className="text-rose-300">[Q]</span> pulso
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 0: PORTAL OFICIAL DE DESCARGAS (GODOT 4) */}
        <section
          id="descargas"
          className="border-t border-amber-500/20 bg-zinc-950/95 py-16 backdrop-blur-md"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                    Motor Godot 4 · Multiplataforma
                  </span>
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-zinc-300">
                    Modo Historia Offline · Red Local LAN · Online MMO
                  </span>
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Descarga el Cliente Nativo (PC y Móvil)
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  Juega sin límites desde tu ordenador o dispositivo móvil con
                  el cliente nativo de VidaLoca MMORPG. Elige tu sistema
                  operativo y descarga la última versión oficial directamente
                  desde GitHub Releases.
                </p>
              </div>

              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-300 transition hover:bg-amber-500 hover:text-zinc-950"
              >
                <span>Ver todas las versiones</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>

            {/* 3 Modos de Juego del Cliente Godot 4 */}
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {GAME_MODES.map((gm) => (
                <div
                  key={gm.title}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"
                >
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${gm.accent}`}
                  >
                    {gm.badge}
                  </span>
                  <h3 className="mt-3 text-base font-black text-white">
                    {gm.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                    {gm.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Tarjetas de Plataformas */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {DOWNLOAD_PLATFORMS.map((plat) => (
                <a
                  key={plat.id}
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 transition ${plat.accent}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        {plat.category}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${plat.badgeClass}`}
                      >
                        {plat.format}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-black text-white">
                      {plat.name}
                    </h3>
                    <p className="mt-1 text-[11px] font-semibold text-amber-400">
                      {plat.requirement}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                      {plat.detail}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2.5 text-xs font-bold text-zinc-100 transition group-hover:border-amber-400/60 group-hover:bg-amber-500 group-hover:text-zinc-950">
                    <span>{plat.cta}</span>
                    <span aria-hidden="true">↗</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 1: CIUDADES VIVAS DE ESPAÑA */}
        <section
          id="ciudades"
          className="border-t border-zinc-800/80 bg-zinc-950/90 py-16 backdrop-blur-md"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  Mapa Persistente
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Ciudades Vivas de España
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  Cada ciudad cuenta con su propia economía, presión policial,
                  rutas de escape y distritos en 3D conectados en tiempo real.
                </p>
              </div>
              <span className="text-xs font-semibold text-zinc-400">
                Haz clic en una ciudad para previsualizar su atmósfera
              </span>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {CITIES.map((city) => {
                const isSelected = selectedCityId === city.id;
                return (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => {
                      setSelectedCityId(city.id);
                      setSceneIndex(city.sceneIndex);
                    }}
                    className={`group overflow-hidden rounded-2xl border text-left transition ${
                      isSelected
                        ? 'border-amber-400/80 bg-zinc-900 shadow-xl shadow-amber-500/10'
                        : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                    }`}
                  >
                    <div className="relative h-48 w-full overflow-hidden">
                      <img
                        src={city.image}
                        alt={`${city.name} — ${city.zone}`}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
                      <span className="absolute left-3 top-3 rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 backdrop-blur">
                        {city.badge}
                      </span>
                      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                        <div>
                          <h3 className="text-xl font-black text-white">
                            {city.name}
                          </h3>
                          <p className="text-xs text-zinc-300">{city.zone}</p>
                        </div>
                        <span className="rounded-md bg-zinc-950/80 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                          Calor: {city.heat}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 p-4">
                      <p className="text-xs leading-relaxed text-zinc-400">
                        {city.description}
                      </p>
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="font-semibold text-amber-400">
                          Sector: {city.economy}
                        </span>
                        <span className="text-zinc-500 group-hover:text-zinc-200">
                          Ver escena →
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 2: FLOTA TOTAL Y FÍSICAS DE DERRAPE */}
        <section
          id="flota"
          className="border-t border-zinc-800/80 bg-zinc-900/75 py-16 backdrop-blur-md"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="space-y-4 lg:col-span-5">
                <p className="text-xs font-bold uppercase tracking-widest text-sky-400">
                  Flota Total &amp; Físicas 3D
                </p>
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Asfalto, Tierra y Aire bajo tu control
                </h2>
                <p className="text-sm leading-relaxed text-zinc-300">
                  Despliega desde un superdeportivo de tracción trasera hasta
                  helicópteros tácticos o camiones de convoy. En los distritos
                  3D puedes subir al instante con{' '}
                  <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-bold text-amber-300">
                    F
                  </kbd>{' '}
                  y encadenar derrapes con{' '}
                  <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-bold text-sky-300">
                    Espacio
                  </kbd>{' '}
                  con humo real de neumáticos, inclinación de chasis y cámara
                  dinámica.
                </p>

                <div className="relative overflow-hidden rounded-2xl border border-zinc-700/80">
                  <img
                    src="/images/valencia-fleet.jpg"
                    alt="Flota táctica en Valencia"
                    className="h-52 w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      Telemetría en vivo · Velocímetro km/h + Drift HUD
                    </span>
                    <span className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-black text-zinc-950">
                      60 FPS
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:col-span-7">
                {FLEET_CATEGORIES.map((v) => (
                  <div
                    key={v.name}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 transition hover:border-sky-500/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">{v.name}</h3>
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                        {v.tag}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-amber-400">
                      {v.spec}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                      {v.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: ARSENAL Y FACCIONES */}
        <section
          id="facciones"
          className="border-t border-zinc-800/80 bg-zinc-950/95 py-16"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-rose-400">
                  Arsenal &amp; Lealtad
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Elige tu Facción y tu Arsenal
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  Impón la ley con equipamiento táctico o domina las calles con
                  el Sindicato. Activa el pulso de combate{' '}
                  <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-bold text-rose-300">
                    Q
                  </kbd>{' '}
                  en el distrito 3D para marcar presencia y responder al
                  instante.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FACTIONS.map((f) => (
                <div
                  key={f.name}
                  className={`flex flex-col justify-between rounded-2xl border p-5 ${f.accent}`}
                >
                  <div>
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${f.badge}`}
                    >
                      {f.role}
                    </span>
                    <h3 className="mt-3 text-xl font-black text-white">
                      {f.name}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                      {f.desc}
                    </p>
                  </div>

                  <ul className="mt-4 space-y-1.5 border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-300">
                    {f.perks.map((perk) => (
                      <li key={perk} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="border-t border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 py-16">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Servidor Abierto 24/7
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Arranca el motor. La ciudad te espera.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
              Crea tu personaje en segundos y despliega directamente en el
              distrito 3D con tu flota, tus contactos y tu facción.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => focusPortal('register')}
                className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/25 transition hover:bg-amber-400"
              >
                Crear Cuenta Gratis
              </button>
              <button
                type="button"
                onClick={() => focusPortal('login')}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-3 text-sm font-bold text-zinc-200 transition hover:border-amber-500/60 hover:text-white"
              >
                Ya tengo cuenta · Entrar
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
