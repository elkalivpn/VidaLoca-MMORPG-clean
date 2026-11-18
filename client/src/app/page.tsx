'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import CinematicBackdrop, {
  CINEMATIC_SCENES,
} from '@/components/CinematicBackdrop';
import VipShowcaseSection from '@/components/VipShowcaseSection';
import AgeGateModal from '@/components/AgeGateModal';
import SceneGallerySection from '@/components/SceneGallerySection';

import type { Player } from '@/types/game';

type AuthResult = {
  accessToken: string;
  user?: { player?: Player | null; username?: string; isGuest?: boolean };
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

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

type DownloadPlatform = {
  id: string;
  name: string;
  format: string;
  category: string;
  requirement: string;
  detail: string;
  cta: string;
  accent: string;
  badgeClass: string;
  pwaGuide: string;
  pwaSteps: string[];
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

const GAME_MODES = [
  {
    title: 'Historia en Solitario',
    badge: 'Progresión Narrativa',
    accent: 'border-amber-500/35 bg-amber-500/10 text-amber-300',
    desc: 'Progresión narrativa por ciudades de España con misiones de historia, contratos y crecimiento de tu personaje.',
  },
  {
    title: 'Mundo Libre Online 3D',
    badge: 'MMORPG en Vivo',
    accent: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
    desc: 'Conducción, derrapes, tiroteos PvP, peleas y Casino +18 en vivo dentro de un mundo abierto compartido.',
  },
  {
    title: 'Cooperativo y Clanes',
    badge: 'Escuadrón & Facciones',
    accent: 'border-sky-500/35 bg-sky-500/10 text-sky-300',
    desc: 'Atracos, misiones con amigos por código de sala y guerras de facciones en tiempo real.',
  },
];

const DOWNLOAD_PLATFORMS: DownloadPlatform[] = [
  {
    id: 'windows',
    name: 'Windows',
    format: 'App PWA · Web 3D',
    category: 'PC · Escritorio',
    requirement: 'Windows 10 / 11 · Chrome, Edge o Brave',
    detail:
      'Instala la App Web PWA en 1 clic con soporte completo de ratón/teclado y mandos PS5, Xbox y Switch.',
    cta: 'Instalar App PWA',
    accent: 'hover:border-sky-400/60',
    badgeClass: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
    pwaGuide:
      'En Chrome o Edge (Windows): haz clic en el icono "Instalar VidaLoca" en la barra de direcciones para abrirlo como app de escritorio en 1 clic.',
    pwaSteps: [
      'Pulsa "Instalar App Ahora" o haz clic en el icono de instalación en la barra de Chrome / Edge.',
      'Confirma "Instalar" para abrir VidaLoca en ventana propia desde tu escritorio o menú Inicio.',
      'Juega al instante en 3D con ratón y teclado o conecta tu mando PS5, Xbox o Switch por USB/Bluetooth.',
    ],
  },
  {
    id: 'macos',
    name: 'macOS',
    format: 'App PWA · Web 3D',
    category: 'PC · Mac',
    requirement: 'macOS 12+ · Safari, Chrome o Edge',
    detail:
      'App Web PWA integrada en tu Dock con soporte completo de ratón/teclado y mandos PS5, Xbox y Switch.',
    cta: 'Instalar App PWA',
    accent: 'hover:border-zinc-400/60',
    badgeClass: 'border-zinc-500/30 bg-zinc-500/15 text-zinc-200',
    pwaGuide:
      'En Safari (macOS Sonoma+) o Chrome: ve a Archivo → "Añadir al Dock" o instala como App PWA para acceso directo desde Spotlight en 1 clic.',
    pwaSteps: [
      'En Safari abre Archivo → "Añadir al Dock" (o pulsa el icono de instalación en Chrome / Edge).',
      'Lanza VidaLoca directamente desde tu Dock o Launchpad en ventana dedicada.',
      'Juega con teclado y ratón o empareja tu mando PS5 DualSense, Xbox o Switch Pro por Bluetooth.',
    ],
  },
  {
    id: 'linux',
    name: 'Linux',
    format: 'App PWA · Web 3D',
    category: 'PC · Linux',
    requirement: 'Distros x86_64 · Chrome, Chromium o Brave',
    detail:
      'App Web PWA en ventana dedicada sin paquetes extra, lista para ratón/teclado y mandos PS5, Xbox y Switch.',
    cta: 'Instalar App PWA',
    accent: 'hover:border-amber-400/60',
    badgeClass: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    pwaGuide:
      'En Chromium / Chrome / Brave para Linux: pulsa el icono de instalación en la barra de URL para ejecutar la app web 3D en ventana dedicada.',
    pwaSteps: [
      'Pulsa el icono "Instalar VidaLoca" en la barra de direcciones de Chrome, Chromium o Brave.',
      'Fija la App Web PWA en tu lanzador de aplicaciones sin instalar dependencias adicionales.',
      'Disfruta de conducción, drift y combate 3D con ratón/teclado o mando PS5, Xbox y Switch.',
    ],
  },
  {
    id: 'android',
    name: 'Android',
    format: 'App PWA · Móvil',
    category: 'Móvil · Tablet',
    requirement: 'Android 9.0+ · Chrome o Edge',
    detail:
      'Instala la App Web PWA en 1 clic con controles táctiles adaptativos o mandos Bluetooth PS5, Xbox y Switch.',
    cta: 'Instalar App PWA',
    accent: 'hover:border-emerald-400/60',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    pwaGuide:
      'En Chrome para Android: pulsa "Instalar App Ahora" o toca el menú (⋮) → "Instalar aplicación" para jugar en pantalla completa.',
    pwaSteps: [
      'Toca "Instalar App Ahora" o abre el menú (⋮) de Chrome → "Instalar aplicación".',
      'Confirma para añadir el icono oficial de VidaLoca a tu pantalla de inicio en segundos.',
      'Juega en pantalla completa con controles táctiles en pantalla o mando PS5, Xbox o Switch por Bluetooth.',
    ],
  },
  {
    id: 'ios',
    name: 'iOS',
    format: 'App PWA · Safari',
    category: 'iPhone & iPad',
    requirement: 'iOS / iPadOS 15+ · Safari',
    detail:
      'App Web PWA oficial en 1 toque desde Safari con controles táctiles y compatibilidad con mandos PS5, Xbox y Switch.',
    cta: 'Instalar App PWA',
    accent: 'hover:border-rose-400/60',
    badgeClass: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
    pwaGuide:
      'En Safari (iPhone / iPad): pulsa Compartir (□↑) → "Añadir a pantalla de inicio" para instalar VidaLoca como app en 1 toque.',
    pwaSteps: [
      'Abre VidaLoca en Safari y pulsa el botón Compartir (□↑) en la barra del navegador.',
      'Selecciona "Añadir a pantalla de inicio" y confirma el acceso directo oficial.',
      'Inicia la App PWA y juega con controles táctiles o conecta tu mando PS5, Xbox o Switch por Bluetooth.',
    ],
  },
];

const ADULT_EXPERIENCE_PILLARS = [
  {
    icon: '🩸',
    title: 'Violencia, Sangre & Tiroteos Realistas',
    badge: 'Combate Crudo',
    desc: 'Enfrentamientos armados en callejones, ajustes de cuentas, sangre e impactos reales sin suavizado.',
    accent: 'border-rose-500/40 bg-rose-950/20 text-rose-300',
  },
  {
    icon: '🏎️',
    title: 'Derrapes Hiperrealistas & Persecuciones',
    badge: 'Física 3D',
    desc: 'Quema rueda en asfalto mojado, escapa de controles policiales a 300 km/h y esquiva bloqueos tácticos.',
    accent: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
  },
  {
    icon: '🎰',
    title: 'Casino Clandestino & Apuestas +18',
    badge: 'Alto Riesgo',
    desc: 'Mesas privadas en Marbella y Madrid donde el dinero cambia de manos sin límites ni supervisión.',
    accent: 'border-fuchsia-500/40 bg-fuchsia-950/20 text-fuchsia-300',
  },
  {
    icon: '🍸',
    title: 'Clubes Nocturnos & Escenas Adultas',
    badge: 'Sin Censura',
    desc: 'Locales VIP, salas privadas nocturnas, música electrónica y tramas adultas exclusivas para mayores de 18.',
    accent: 'border-purple-500/40 bg-purple-950/20 text-purple-300',
  },
  {
    icon: '📦',
    title: 'Drogas, Contrabando & Mercado Negro',
    badge: 'Economía Ilícita',
    desc: 'Convoyes nocturnos por puertos del Atlántico y Mediterráneo, pisos francos y subastas clandestinas.',
    accent: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
  },
];

const NAV_LINKS = [
  { href: '#escenas', label: 'Escenas', highlight: false },
  { href: '#club-vip', label: '👑 Club VIP', highlight: true },
  { href: '#descargas', label: 'App PWA', highlight: false },
  { href: '#ciudades', label: 'Ciudades', highlight: false },
  { href: '#flota', label: 'Flota & Drift', highlight: false },
  { href: '#facciones', label: 'Facciones', highlight: false },
];

export default function HomePage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selectedCityId, setSelectedCityId] = useState<string>('madrid');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ageModalOpen, setAgeModalOpen] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [selectedDownload, setSelectedDownload] =
    useState<DownloadPlatform | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [pwaStatusMsg, setPwaStatusMsg] = useState('');

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const activeScene = CINEMATIC_SCENES[sceneIndex] ?? CINEMATIC_SCENES[0];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref')?.trim().toUpperCase();
    if (ref) {
      setReferralCode(ref);
      setMode('register');
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (
      mode === 'register' &&
      (password.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password))
    ) {
      setError(
        'La contraseña debe tener al menos 8 caracteres e incluir una letra y un número.',
      );
      return;
    }
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
              ...(referralCode.trim()
                ? { referralCode: referralCode.trim().toUpperCase() }
                : {}),
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

  async function playAsGuest() {
    setError('');
    setLoading(true);
    try {
      const data = (await api.guestLogin({
        ...(referralCode.trim()
          ? { referralCode: referralCode.trim().toUpperCase() }
          : {}),
      })) as AuthResult;
      const player = data.user?.player ?? null;
      setAuth(data.accessToken, player);
      router.push('/play');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al entrar como invitado',
      );
    } finally {
      setLoading(false);
    }
  }

  function focusPortal(nextMode?: 'login' | 'register') {
    if (nextMode) setMode(nextMode);
    setMobileMenuOpen(false);
    document.getElementById('portal')?.scrollIntoView({ behavior: 'smooth' });
    window.setTimeout(() => {
      emailInputRef.current?.focus();
    }, 350);
  }

  function getRecommendedPlatform(): DownloadPlatform {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) {
        return (
          DOWNLOAD_PLATFORMS.find((p) => p.id === 'ios') ??
          DOWNLOAD_PLATFORMS[0]
        );
      }
      if (/android/.test(ua)) {
        return (
          DOWNLOAD_PLATFORMS.find((p) => p.id === 'android') ??
          DOWNLOAD_PLATFORMS[0]
        );
      }
      if (/mac os|macintosh/.test(ua)) {
        return (
          DOWNLOAD_PLATFORMS.find((p) => p.id === 'macos') ??
          DOWNLOAD_PLATFORMS[0]
        );
      }
      if (/linux/.test(ua)) {
        return (
          DOWNLOAD_PLATFORMS.find((p) => p.id === 'linux') ??
          DOWNLOAD_PLATFORMS[0]
        );
      }
    }
    return DOWNLOAD_PLATFORMS[0];
  }

  function openPwaGuide(platform?: DownloadPlatform) {
    setPwaStatusMsg('');
    setSelectedDownload(platform ?? getRecommendedPlatform());
  }

  async function triggerPwaInstall() {
    setPwaStatusMsg('');
    if (!deferredInstallPrompt) {
      setPwaStatusMsg(
        'Sigue la guía rápida de tu navegador arriba o entra al instante en el juego web 3D.',
      );
      return;
    }
    try {
      await deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setPwaStatusMsg('✓ VidaLoca instalada como aplicación PWA.');
        setDeferredInstallPrompt(null);
      } else {
        setPwaStatusMsg(
          'Instalación cancelada. Puedes volver a intentarlo o jugar ahora en el navegador.',
        );
      }
    } catch {
      setPwaStatusMsg(
        'Usa la opción "Instalar / Añadir a inicio" en el menú de tu navegador.',
      );
    }
  }

  const passwordValid =
    password.length >= 8 && /^(?=.*[A-Za-z])(?=.*\d).+$/.test(password);

  return (
    <div className="relative min-h-screen text-zinc-100 selection:bg-amber-500 selection:text-zinc-950">
      <CinematicBackdrop
        activeIndex={sceneIndex}
        onIndexChange={setSceneIndex}
      />

      <AgeGateModal
        forceOpen={ageModalOpen}
        onClose={() => setAgeModalOpen(false)}
        onVerifiedChange={setAgeVerified}
      />

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/70 bg-zinc-950/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <a href="#portal" className="flex items-center gap-2.5">
              <img
                src="/images/vidaloca-logo.png"
                alt="VidaLoca MMORPG Logo Oficial"
                className="h-9 w-9 rounded-xl border border-amber-500/40 bg-zinc-900 object-cover shadow-lg shadow-amber-500/20"
              />
              <div>
                <span className="text-base font-black tracking-wider text-zinc-100">
                  VIDALOCA
                </span>
                <span className="ml-2 hidden rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300 sm:inline-block">
                  MMORPG
                </span>
              </div>
            </a>

            <button
              type="button"
              onClick={() => setAgeModalOpen(true)}
              title="Ver clasificación +18 y advertencias de contenido adulto"
              className="inline-flex items-center gap-1 rounded-md border border-rose-500/60 bg-rose-600/90 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm shadow-rose-600/30 transition hover:bg-rose-500"
            >
              <span>+18</span>
              <span className="hidden text-[9px] font-bold text-rose-100 sm:inline">
                {ageVerified ? 'Verificado' : 'Adultos'}
              </span>
            </button>
          </div>

          <nav className="hidden items-center gap-5 text-xs font-semibold uppercase tracking-wider text-zinc-300 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={
                  link.highlight
                    ? 'text-amber-300 transition hover:text-amber-200'
                    : 'transition hover:text-amber-400'
                }
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 sm:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              España · En Vivo
            </span>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label="Abrir menú de navegación"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-xs font-bold text-zinc-100 transition hover:border-amber-400 md:hidden"
            >
              <span>{mobileMenuOpen ? '✕' : '☰'}</span>
              <span>Menú</span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-zinc-800 bg-zinc-950/95 px-4 py-4 backdrop-blur-xl md:hidden">
            <nav className="grid grid-cols-2 gap-2">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                    link.highlight
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                      : 'border-zinc-800 bg-zinc-900/80 text-zinc-200 hover:border-amber-400/50'
                  }`}
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#experiencia-18"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-300"
              >
                +18 Sin Censura
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAgeModalOpen(true);
                }}
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-300"
              >
                Detalle Legal +18
              </button>
            </nav>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setMobileMenuOpen(false);
                  void playAsGuest();
                }}
                className="flex-1 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-950 disabled:opacity-50"
              >
                ⚡ Jugar Ya (Invitado)
              </button>
              <button
                type="button"
                onClick={() => focusPortal('login')}
                className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2.5 text-xs font-bold text-amber-200"
              >
                Entrar
              </button>
            </div>
          </div>
        )}
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
              <button
                type="button"
                onClick={() => setAgeModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/60 bg-rose-600/20 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-rose-300 transition hover:bg-rose-600/35"
              >
                <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] text-white">
                  +18
                </span>
                <span>Contenido Adulto · Sin Censura</span>
              </button>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-300">
                Mundo Libre en Vivo
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-[11px] font-medium text-zinc-300">
                Conducción &amp; Derrape 3D
              </span>
            </div>

            {/* Official Crest Card + Headline */}
            <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800/90 bg-zinc-950/65 p-4 backdrop-blur-md sm:flex-row sm:items-center">
              <img
                src="/images/vidaloca-logo.png"
                alt="Identidad Oficial VidaLoca MMORPG"
                className="h-24 w-24 shrink-0 rounded-2xl border border-amber-500/40 bg-zinc-900 object-cover shadow-xl shadow-amber-500/15 sm:h-28 sm:w-28"
              />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    Edición Nocturna +18 · España 3D
                  </span>
                  <span className="rounded border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-black text-rose-300">
                    Violencia · Casino · Clubes VIP
                  </span>
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  VIDALOCA —{' '}
                  <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                    España es tuya
                  </span>
                </h1>
              </div>
            </div>

            <div className="space-y-3">
              <p className="max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                Domina el asfalto de Gran Vía, cierra tratos en clubes privados
                de Puerto Banús o lidera tiroteos y persecuciones en Barcelona.
                Sube a tu moto o superdeportivo, quema rueda con físicas de
                derrape y construye tu imperio en un mundo abierto +18
                persistente.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    void playAsGuest();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-500/25 transition hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-50"
                >
                  <span>⚡ Jugar Ya en 1 Clic (Invitado)</span>
                </button>
                <a
                  href="#escenas"
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-5 py-3 text-xs font-black uppercase tracking-wider text-amber-200 transition hover:bg-amber-500/25"
                >
                  <span>Ver Escenas</span>
                  <span aria-hidden="true">→</span>
                </a>
                <a
                  href="#descargas"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/25 transition hover:from-amber-300 hover:to-amber-400"
                >
                  <span>Instalar App PWA</span>
                  <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>

            {/* Scene Selector (5 scenes synced with CinematicBackdrop) */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-4 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    Escena Activa · {activeScene.district}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-300">
                    {activeScene.tagline}
                  </p>
                </div>
                <a
                  href="#escenas"
                  className="text-[11px] font-bold text-amber-300 transition hover:text-amber-200"
                >
                  Galería completa →
                </a>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {CINEMATIC_SCENES.map((sc, idx) => {
                  const active = idx === sceneIndex;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSceneIndex(idx)}
                      className={`group flex items-center justify-between gap-1.5 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow-lg shadow-amber-500/10'
                          : 'border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                      }`}
                    >
                      <span className="truncate">{sc.city}</span>
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          active ? 'bg-amber-400' : 'bg-zinc-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 pt-1 sm:max-w-xl sm:grid-cols-4">
              <a
                href="#ciudades"
                className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3 py-2.5 backdrop-blur-sm transition hover:border-amber-500/40"
              >
                <p className="text-lg font-black text-amber-400">6</p>
                <p className="text-[11px] text-zinc-400">Ciudades Vivas</p>
              </a>
              <a
                href="#flota"
                className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3 py-2.5 backdrop-blur-sm transition hover:border-sky-500/40"
              >
                <p className="text-lg font-black text-sky-400">44</p>
                <p className="text-[11px] text-zinc-400">Vehículos (8 VIP)</p>
              </a>
              <a
                href="#facciones"
                className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3 py-2.5 backdrop-blur-sm transition hover:border-emerald-500/40"
              >
                <p className="text-lg font-black text-emerald-400">78</p>
                <p className="text-[11px] text-zinc-400">Misiones (10 VIP)</p>
              </a>
              <a
                href="#club-vip"
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 backdrop-blur-sm transition hover:border-amber-400"
              >
                <p className="text-lg font-black text-amber-300">21</p>
                <p className="text-[11px] font-semibold text-amber-200">
                  👑 Ofertas VIP
                </p>
              </a>
            </div>
          </div>

          {/* Right Column: Glassmorphic Auth Portal */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/85 p-6 shadow-2xl shadow-black/80 backdrop-blur-xl sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    Acceso al Servidor · +18
                  </p>
                  <h2 className="mt-0.5 text-2xl font-black tracking-tight text-white">
                    {mode === 'login'
                      ? 'Entrar al Distrito'
                      : 'Crear Personaje'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setAgeModalOpen(true)}
                  className="rounded-lg border border-rose-500/50 bg-rose-600/20 px-2.5 py-1 text-[10px] font-black text-rose-300 transition hover:bg-rose-600/35"
                >
                  +18 · 3D
                </button>
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
                  <label
                    htmlFor="auth-email"
                    className="mb-1 block text-[11px] font-medium text-zinc-400"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="auth-email"
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
                    <label
                      htmlFor="auth-username"
                      className="mb-1 block text-[11px] font-medium text-zinc-400"
                    >
                      Nombre en la calle
                    </label>
                    <input
                      id="auth-username"
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
                  <div className="mb-1 flex items-center justify-between">
                    <label
                      htmlFor="auth-password"
                      className="block text-[11px] font-medium text-zinc-400"
                    >
                      Contraseña
                    </label>
                    {mode === 'register' && (
                      <span
                        className={`text-[10px] font-semibold ${
                          password.length === 0
                            ? 'text-zinc-500'
                            : passwordValid
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                        }`}
                      >
                        {password.length === 0
                          ? 'Mín. 8 car. (letra + número)'
                          : passwordValid
                            ? '✓ Contraseña segura'
                            : password.length < 8
                              ? `Faltan ${8 - password.length} caracteres`
                              : 'Incluye letra y número'}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      minLength={mode === 'register' ? 8 : undefined}
                      className="w-full rounded-xl border border-zinc-700/90 bg-zinc-900/90 py-2.5 pl-3.5 pr-20 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={
                        mode === 'login' ? 'current-password' : 'new-password'
                      }
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-zinc-700 bg-zinc-800/90 px-2 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-amber-400 hover:text-white"
                    >
                      {showPassword ? '🙈 Ocultar' : '👁️ Ver'}
                    </button>
                  </div>
                </div>

                {mode === 'register' && (
                  <div>
                    <label
                      htmlFor="auth-referral"
                      className="mb-1 block text-[11px] font-medium text-zinc-400"
                    >
                      Código de referido (opcional · +1.500 € y +15 VC)
                    </label>
                    <input
                      id="auth-referral"
                      className="w-full rounded-xl border border-zinc-700/90 bg-zinc-900/90 px-3.5 py-2 text-sm uppercase text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400"
                      placeholder="VL-XXXXXX"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                    />
                  </div>
                )}

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

              <div className="mt-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    void playAsGuest();
                  }}
                  className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  ⚡ Probar Gratis en 1 Clic (Modo Invitado)
                </button>
              </div>

              <p className="mt-3 text-center text-[11px] text-zinc-400">
                <button
                  type="button"
                  onClick={() => setAgeModalOpen(true)}
                  className="font-semibold text-rose-300 underline decoration-rose-500/50 underline-offset-2 transition hover:text-rose-200"
                >
                  Juego exclusivo +18
                </button>{' '}
                · Al entrar confirmas ser mayor de edad y aceptas la temática
                adulta.
              </p>

              <p className="mt-2.5 text-center text-[11px] text-zinc-400">
                Controles 3D: <span className="text-zinc-200">WASD</span> mover
                · <span className="text-amber-300">[F]</span> vehículo ·{' '}
                <span className="text-sky-300">[Espacio]</span> drift ·{' '}
                <span className="text-rose-300">[Q]</span> pulso
              </p>
            </div>
          </div>
        </section>

        {/* INTERACTIVE SCENE GALLERY (#escenas) */}
        <SceneGallerySection
          activeSceneIndex={sceneIndex}
          loading={loading}
          onSelectBackdropScene={(idx) => setSceneIndex(idx)}
          onPlayScenePortal={(idx) => {
            setSceneIndex(idx);
            focusPortal('login');
          }}
          onPlayGuest={() => {
            void playAsGuest();
          }}
        />

        {/* +18 REALISTIC & UNCENSORED EXPERIENCE SECTION */}
        <section
          id="experiencia-18"
          className="border-t border-rose-500/30 bg-gradient-to-b from-zinc-950 via-rose-950/15 to-zinc-950 py-16 backdrop-blur-md"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-rose-600 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-white shadow shadow-rose-600/30">
                    +18 Solo Adultos
                  </span>
                  <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-300">
                    Sin Filtros · Realismo Urbano Crudo
                  </span>
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Experiencia +18 Realista &amp; Sin Censura
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                  VidaLoca MMORPG está diseñado exclusivamente para público
                  adulto. Cada distrito combina acción letal, clubes privados,
                  economía ilegal y conducción al límite.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setAgeModalOpen(true)}
                  className="rounded-xl border border-rose-500/50 bg-rose-600/20 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-200 transition hover:bg-rose-600/35"
                >
                  Ver Detalles +18
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    void playAsGuest();
                  }}
                  className="rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-950 transition hover:brightness-110 disabled:opacity-50"
                >
                  ⚡ Entrar al Mundo +18
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {ADULT_EXPERIENCE_PILLARS.map((pillar) => (
                <div
                  key={pillar.title}
                  className={`flex flex-col justify-between rounded-2xl border p-5 ${pillar.accent}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xl" aria-hidden="true">
                        {pillar.icon}
                      </span>
                      <span className="rounded-md border border-zinc-700/80 bg-zinc-950/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-200">
                        {pillar.badge}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-black text-white">
                      {pillar.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                      {pillar.desc}
                    </p>
                  </div>
                  <div className="mt-4 border-t border-zinc-800/70 pt-2.5 text-[10px] font-bold uppercase tracking-widest text-rose-300">
                    Clasificación +18 Activa
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <VipShowcaseSection
          loading={loading}
          onPlayGuest={() => {
            void playAsGuest();
          }}
          onJoinClub={() => focusPortal('register')}
        />

        {/* SECTION 0: PORTAL OFICIAL WEB 3D & APP PWA */}
        <section
          id="descargas"
          className="border-t border-amber-500/20 bg-zinc-950/95 py-16 backdrop-blur-md"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                    Web 3D +18 · Multiplataforma · App PWA Oficial
                  </span>
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-zinc-300">
                    Ratón/Teclado · Táctil · Mandos PS5 / Xbox / Switch
                  </span>
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Juega al Instante en Web 3D o Instala la App PWA Oficial
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  Entra directo en el navegador 3D o elige tu plataforma para
                  instalar la App Web PWA oficial en 1 clic con soporte completo
                  de ratón/teclado, controles táctiles o mandos PS5, Xbox y
                  Switch.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    void playAsGuest();
                  }}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  ⚡ Jugar Ahora en Web 3D
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deferredInstallPrompt) {
                      openPwaGuide();
                      void triggerPwaInstall();
                    } else {
                      openPwaGuide();
                    }
                  }}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-300 transition hover:bg-amber-500 hover:text-zinc-950"
                >
                  <span>📲 Instalar App PWA (1 Clic)</span>
                </button>
              </div>
            </div>

            {/* 3 Modos Reales del MMORPG */}
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

            {/* 5 Plataformas Compatibles -> Abren Guía PWA en 1 Clic */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {DOWNLOAD_PLATFORMS.map((plat) => (
                <button
                  key={plat.id}
                  type="button"
                  onClick={() => openPwaGuide(plat)}
                  className={`group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 text-left transition ${plat.accent}`}
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
                    <span aria-hidden="true">→</span>
                  </div>
                </button>
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
                          {isSelected ? '✓ Escena activa' : 'Activar escena →'}
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
              Servidor Abierto 24/7 · Clasificación +18
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
                disabled={loading}
                onClick={() => {
                  void playAsGuest();
                }}
                className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                ⚡ Jugar en 1 Clic (Invitado)
              </button>
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

      {/* COMPLETE PROFESSIONAL FOOTER */}
      <footer className="relative z-10 border-t border-zinc-800 bg-zinc-950 px-4 py-12 text-xs text-zinc-400 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/images/vidaloca-logo.png"
                alt="VidaLoca MMORPG"
                className="h-9 w-9 rounded-xl border border-amber-500/40 object-cover"
              />
              <div>
                <p className="text-sm font-black tracking-wider text-white">
                  VIDALOCA MMORPG
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  Mundo Abierto 3D · España
                </p>
              </div>
            </div>
            <p className="leading-relaxed text-zinc-400">
              Experiencia multijugador urbana en vivo con conducción 3D, drift,
              combate, facciones, economía P2P y Club VIP.
            </p>
            <button
              type="button"
              onClick={() => setAgeModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-600/20 px-2.5 py-1 text-[11px] font-black text-rose-300 transition hover:bg-rose-600/35"
            >
              <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] text-white">
                +18
              </span>
              <span>Revisar Advertencia Adultos</span>
            </button>
          </div>

          {/* Explore Links */}
          <div>
            <p className="font-black uppercase tracking-wider text-zinc-200">
              Explorar Mundo
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <a href="#escenas" className="transition hover:text-amber-300">
                  Escenas en Vivo (+18)
                </a>
              </li>
              <li>
                <a
                  href="#experiencia-18"
                  className="transition hover:text-rose-300"
                >
                  Experiencia +18 Sin Censura
                </a>
              </li>
              <li>
                <a href="#club-vip" className="transition hover:text-amber-300">
                  👑 Club VIP &amp; Catálogo
                </a>
              </li>
              <li>
                <a href="#ciudades" className="transition hover:text-amber-300">
                  Ciudades de España
                </a>
              </li>
              <li>
                <a href="#flota" className="transition hover:text-amber-300">
                  Flota Total &amp; Drift
                </a>
              </li>
              <li>
                <a
                  href="#facciones"
                  className="transition hover:text-amber-300"
                >
                  Facciones &amp; Arsenal
                </a>
              </li>
            </ul>
          </div>

          {/* PWA & Platforms Links */}
          <div>
            <p className="font-black uppercase tracking-wider text-zinc-200">
              Web 3D &amp; App PWA
            </p>
            <ul className="mt-3 space-y-2">
              {DOWNLOAD_PLATFORMS.map((plat) => (
                <li key={plat.id}>
                  <button
                    type="button"
                    onClick={() => openPwaGuide(plat)}
                    className="transition hover:text-amber-300"
                  >
                    {plat.name} ({plat.format})
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => openPwaGuide()}
                  className="font-semibold text-amber-400 transition hover:text-amber-300"
                >
                  📲 Guía de Instalación PWA (1 Clic)
                </button>
              </li>
            </ul>
          </div>

          {/* Quick Actions */}
          <div>
            <p className="font-black uppercase tracking-wider text-zinc-200">
              Acceso Rápido
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    void playAsGuest();
                  }}
                  className="font-bold text-emerald-400 transition hover:text-emerald-300 disabled:opacity-50"
                >
                  ⚡ Entrar como Invitado en 1 Clic
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => focusPortal('login')}
                  className="transition hover:text-amber-300"
                >
                  Iniciar Sesión
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => focusPortal('register')}
                  className="transition hover:text-amber-300"
                >
                  Crear Cuenta Nueva
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setAgeModalOpen(true)}
                  className="text-rose-300 transition hover:text-rose-200"
                >
                  Clasificación +18 y Cumplimiento
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-zinc-800/80 pt-6 text-[11px] text-zinc-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} VidaLoca MMORPG · Contenido ficticio
            para mayores de 18 años (+18).
          </p>
          <a
            href="#portal"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-semibold text-zinc-300 transition hover:border-amber-400 hover:text-amber-300"
          >
            Volver arriba ↑
          </a>
        </div>
      </footer>

      {/* SMART WEB 3D / PWA INSTALL MODAL */}
      {selectedDownload && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-xl"
        >
          <div className="animate-modal-in relative w-full max-w-xl overflow-hidden rounded-3xl border border-amber-500/40 bg-zinc-900 shadow-2xl shadow-black">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-emerald-400 to-sky-500" />
            <div className="max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${selectedDownload.badgeClass}`}
                    >
                      {selectedDownload.format}
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-400">
                      {selectedDownload.category}
                    </span>
                  </div>
                  <h3
                    id="download-modal-title"
                    className="mt-2 text-2xl font-black text-white"
                  >
                    App PWA Oficial para {selectedDownload.name}
                  </h3>
                  <p className="mt-0.5 text-xs font-semibold text-amber-400">
                    {selectedDownload.requirement}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDownload(null)}
                  aria-label="Cerrar guía de instalación PWA"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-amber-400 hover:text-white"
                >
                  ✕ Cerrar
                </button>
              </div>

              {/* Instant Play Option (Zero Friction) */}
              <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-950/25 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  Opción Recomendada · Sin Esperas
                </p>
                <p className="mt-1 text-xs text-zinc-300">
                  ¿Quieres entrar ahora mismo? Juega al instante en Web 3D desde
                  tu navegador con tu misma cuenta y progreso en España.
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setSelectedDownload(null);
                    void playAsGuest();
                  }}
                  className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-50"
                >
                  ⚡ Jugar Ahora en Web 3D (Sin esperas)
                </button>
              </div>

              {/* 1-Click PWA Guide */}
              <div className="mt-4 rounded-2xl border border-sky-500/35 bg-sky-950/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-wider text-sky-300">
                    Instalación Rápida App PWA (1 Clic)
                  </p>
                  {deferredInstallPrompt && (
                    <button
                      type="button"
                      onClick={() => {
                        void triggerPwaInstall();
                      }}
                      className="rounded-lg bg-sky-400 px-3 py-1 text-[11px] font-black text-zinc-950 transition hover:bg-sky-300"
                    >
                      Instalar App Ahora
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
                  {selectedDownload.pwaGuide}
                </p>
                {pwaStatusMsg && (
                  <p className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-200">
                    {pwaStatusMsg}
                  </p>
                )}
              </div>

              {/* Step-by-step PWA & Controls Support */}
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                    Pasos PWA en {selectedDownload.name}
                  </p>
                  <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                    Ratón/Teclado · Táctil · PS5/Xbox/Switch
                  </span>
                </div>
                <ol className="mt-2.5 space-y-1.5 text-xs text-zinc-300">
                  {selectedDownload.pwaSteps.map((step, idx) => (
                    <li key={step} className="flex gap-2">
                      <span className="font-black text-amber-400">
                        {idx + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  {deferredInstallPrompt ? (
                    <button
                      type="button"
                      onClick={() => {
                        void triggerPwaInstall();
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 transition hover:bg-amber-400"
                    >
                      <span>📲 Instalar App PWA Ahora</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDownload(null);
                        focusPortal('login');
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 transition hover:bg-amber-400"
                    >
                      <span>Ir al Portal de Acceso</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedDownload(null)}
                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-xs font-bold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
