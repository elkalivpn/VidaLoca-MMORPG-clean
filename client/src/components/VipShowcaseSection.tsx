'use client';

import { useState } from 'react';

type ShowcaseCategory = 'ALL' | 'CHARACTER' | 'CLOTHING' | 'VEHICLE' | 'EMPIRE';

type ShowcaseItem = {
  id: string;
  category: Exclude<ShowcaseCategory, 'ALL'>;
  badge: string;
  title: string;
  subtitle: string;
  priceLabel: string;
  description: string;
  accent: string;
};

const VIP_PERKS = [
  {
    label: '+25% XP Global',
    detail: 'Subida de nivel acelerada en toda actividad',
  },
  {
    label: '+15% € Misiones',
    detail: 'Mayor botín limpio en contratos y golpes',
  },
  {
    label: '+15% Renta / Hora',
    detail: 'Rendimiento extra en propiedades y garajes',
  },
  {
    label: '2% Tasa Mercado P2P',
    detail: 'Comisión reducida frente al 5% estándar',
  },
  {
    label: '10 Misiones VIP',
    detail: 'Contratos exclusivos de alto riesgo y pago',
  },
  {
    label: 'Flota & Mansiones VIP',
    detail: '8 vehículos élite y 4 propiedades únicas',
  },
];

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    id: 'char-jefa',
    category: 'CHARACTER',
    badge: '🎭 Personaje VIP',
    title: 'La Jefa de Ibiza',
    subtitle: '+10% reputación · Presencia balear',
    priceLabel: '140 VC',
    description:
      'Personaje jugable exclusivo equipable junto a tu vestimenta y armas en el HUD en vivo.',
    accent: 'border-fuchsia-500/35 bg-fuchsia-950/20',
  },
  {
    id: 'char-sombra',
    category: 'CHARACTER',
    badge: '🎭 Personaje VIP',
    title: 'Agente Sombra CNI',
    subtitle: 'Operador encubierto · Sigilo urbano',
    priceLabel: '110 VC',
    description:
      'Perfil táctico de infiltración diseñado para misiones nocturnas y evasión policial.',
    accent: 'border-fuchsia-500/35 bg-fuchsia-950/20',
  },
  {
    id: 'char-magnate',
    category: 'CHARACTER',
    badge: '🎭 Personaje VIP',
    title: 'Magnate de Puerto Banús',
    subtitle: 'Alto standing · Negociación Marbella',
    priceLabel: '160 VC',
    description:
      'Identidad legendaria para dominar subastas P2P, clubes privados y rentas inmobiliarias.',
    accent: 'border-fuchsia-500/35 bg-fuchsia-950/20',
  },
  {
    id: 'cloth-esmoquin',
    category: 'CLOTHING',
    badge: '👔 Vestimenta VIP',
    title: 'Esmoquin Blanco Puerto Banús',
    subtitle: 'Gala nocturna · Intercambiable P2P',
    priceLabel: '55 VC',
    description:
      'Equipable simultáneamente con tu personaje y cosméticos para lucir en los distritos.',
    accent: 'border-cyan-500/35 bg-cyan-950/20',
  },
  {
    id: 'cloth-kevlar',
    category: 'CLOTHING',
    badge: '👔 Vestimenta VIP',
    title: 'Gabardina Táctica Kevlar',
    subtitle: '+22 blindaje en asaltos',
    priceLabel: '85 VC',
    description:
      'Placas balísticas ocultas bajo corte elegante. Protege sin perder presencia en calle.',
    accent: 'border-cyan-500/35 bg-cyan-950/20',
  },
  {
    id: 'cloth-gafas',
    category: 'CLOTHING',
    badge: '👔 Vestimenta VIP',
    title: 'Gafas Aviador Oro 24K',
    subtitle: 'Filtro nocturno · Carisma VIP',
    priceLabel: '35 VC',
    description:
      'Complemento de lujo coleccionable e intercambiable entre jugadores en el Mercado P2P.',
    accent: 'border-cyan-500/35 bg-cyan-950/20',
  },
  {
    id: 'veh-bolide',
    category: 'VEHICLE',
    badge: '🏎️ Coche VIP',
    title: 'Bolide Track Edition VIP',
    subtitle: 'Velocidad 99 · Manejo 98',
    priceLabel: '👑 SOLO VIP · 480 VC',
    description:
      'Hiperdeportivo de circuito homologado para fugas de alta velocidad por autovías.',
    accent: 'border-amber-500/35 bg-amber-950/20',
  },
  {
    id: 'veh-sf90',
    category: 'VEHICLE',
    badge: '🏎️ Coche VIP',
    title: 'SF90 XX Stradale VIP',
    subtitle: 'Ferrari · Velocidad 98 · Manejo 97',
    priceLabel: '👑 SOLO VIP · 420 VC',
    description:
      'Tracción total híbrida con aceleración instantánea y paso por curva quirúrgico.',
    accent: 'border-amber-500/35 bg-amber-950/20',
  },
  {
    id: 'veh-pershing',
    category: 'VEHICLE',
    badge: '🛥️ Yate VIP',
    title: 'Pershing 8X Costa del Sol VIP',
    subtitle: 'Pershing · Velocidad 92',
    priceLabel: '👑 SOLO VIP · 650 VC',
    description:
      'Embarcación rápida de lujo para rutas offshore entre Marbella, Ibiza y Baleares.',
    accent: 'border-amber-500/35 bg-amber-950/20',
  },
  {
    id: 'emp-bunker',
    category: 'EMPIRE',
    badge: '🏰 Propiedad VIP',
    title: 'Búnker Subterráneo Serrano VIP',
    subtitle: 'Madrid · 24 plazas · 5.400 €/h',
    priceLabel: '👑 SOLO VIP',
    description:
      'Almacén blindado de alta capacidad con +15% de rendimiento por hora con Club VIP activo.',
    accent: 'border-emerald-500/35 bg-emerald-950/20',
  },
  {
    id: 'emp-atico',
    category: 'EMPIRE',
    badge: '🏰 Propiedad VIP',
    title: 'Ático Casino La Concha VIP',
    subtitle: 'San Sebastián · 18 plazas · +15% renta',
    priceLabel: '👑 SOLO VIP',
    description:
      'Residencia panorámica frente a la bahía con ingresos pasivos élite cada hora.',
    accent: 'border-emerald-500/35 bg-emerald-950/20',
  },
  {
    id: 'emp-misiones',
    category: 'EMPIRE',
    badge: '🎯 10 Misiones VIP',
    title: 'Contratos Exclusivos + Arsenal Oro',
    subtitle: 'Desert Eagle Baño Oro · Katana Neo',
    priceLabel: '👑 +25% XP / +15% €',
    description:
      'Diez operaciones exclusivas para miembros VIP con recompensas multiplicadas y botín único.',
    accent: 'border-emerald-500/35 bg-emerald-950/20',
  },
];

const FILTERS: { id: ShowcaseCategory; label: string }[] = [
  { id: 'ALL', label: 'Todo el Catálogo VIP (12)' },
  { id: 'CHARACTER', label: '🎭 Personajes' },
  { id: 'CLOTHING', label: '👔 Vestimenta' },
  { id: 'VEHICLE', label: '🏎️ Coches VIP' },
  { id: 'EMPIRE', label: '🏰 Mansiones & Misiones' },
];

type VipShowcaseSectionProps = {
  loading: boolean;
  onPlayGuest: () => void;
  onJoinClub: () => void;
};

export default function VipShowcaseSection({
  loading,
  onPlayGuest,
  onJoinClub,
}: VipShowcaseSectionProps) {
  const [filter, setFilter] = useState<ShowcaseCategory>('ALL');

  const visibleItems =
    filter === 'ALL'
      ? SHOWCASE_ITEMS
      : SHOWCASE_ITEMS.filter((item) => item.category === filter);

  return (
    <section
      id="club-vip"
      className="border-t border-amber-500/30 bg-gradient-to-b from-zinc-950 via-amber-950/10 to-zinc-950 py-16 backdrop-blur-md"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                👑 Nuevo · Club VIP &amp; VidaCoins
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-zinc-300">
                21 Ofertas VIP · 44 Vehículos · 78 Misiones · 26 Propiedades
              </span>
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Club VIP, Personajes, Vestimenta y Flota Exclusiva
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-300">
              Equipa personaje, vestimenta, arma y cosmético al mismo tiempo,
              desbloquea 8 superdeportivos y yates VIP, 4 mansiones y 10
              misiones exclusivas con multiplicadores reales en Historia en
              Solitario, Mundo Libre Online 3D y Cooperativo y Clanes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={onPlayGuest}
              className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/25 transition hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
            >
              👑 Ver Tienda VIP en Juego
            </button>
            <button
              type="button"
              onClick={onJoinClub}
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-200 transition hover:bg-amber-500/20"
            >
              Crear Cuenta
            </button>
          </div>
        </div>

        {/* 6 Beneficios del Club VIP */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {VIP_PERKS.map((perk) => (
            <div
              key={perk.label}
              className="rounded-xl border border-amber-500/30 bg-zinc-900/80 p-3.5"
            >
              <p className="text-xs font-black text-amber-300">{perk.label}</p>
              <p className="mt-1 text-[11px] leading-snug text-zinc-400">
                {perk.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Filtros de categoría */}
        <div className="mt-8 flex flex-wrap gap-2">
          {FILTERS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? 'border-amber-400 bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                    : 'border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-amber-500/40 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Grid de artículos destacados */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition hover:scale-[1.01] ${item.accent}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-zinc-700/80 bg-zinc-950/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-200">
                    {item.badge}
                  </span>
                  <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-black text-amber-300">
                    {item.priceLabel}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-black text-white">
                  {item.title}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-amber-300/90">
                  {item.subtitle}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
