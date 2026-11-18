'use client';

import { useEffect, useState } from 'react';

export type CinematicScene = {
  id: string;
  city: string;
  district: string;
  tagline: string;
  image: string;
  accent: string;
};

export const CINEMATIC_SCENES: CinematicScene[] = [
  {
    id: 'madrid',
    city: 'Madrid',
    district: 'Gran Vía · Centro Financiero',
    tagline:
      'Asfalto mojado, neones de alta gama y control total de la capital.',
    image: '/images/madrid-hero.jpg',
    accent: 'from-amber-500/25',
  },
  {
    id: 'marbella',
    city: 'Marbella',
    district: 'Puerto Banús · Costa del Sol',
    tagline:
      'Yates privados, superdeportivos y negocios de alto voltaje junto al mar.',
    image: '/images/marbella-banus.jpg',
    accent: 'from-sky-500/25',
  },
  {
    id: 'barcelona',
    city: 'Barcelona',
    district: 'Barrio Gótico · Las Ramblas',
    tagline:
      'Persecuciones entre callejones históricos, 4x4 tácticos y motos rápidas.',
    image: '/images/barcelona-chase.jpg',
    accent: 'from-rose-500/25',
  },
  {
    id: 'valencia',
    city: 'Valencia',
    district: 'Ciudad de las Artes · Puerto',
    tagline:
      'Despliegue aéreo, convoyes blindados y dominio táctico del Levante.',
    image: '/images/valencia-fleet.jpg',
    accent: 'from-emerald-500/25',
  },
  {
    id: 'moto_noche',
    city: 'Noche & Asfalto',
    district: 'Ruta Clandestina · +18',
    tagline:
      'Motos deportivas, neones reales, tiroteos, clubes sin censura y adrenalina pura.',
    image: '/images/vidaloca-loading.png',
    accent: 'from-fuchsia-500/25',
  },
];

interface CinematicBackdropProps {
  activeIndex?: number;
  onIndexChange?: (index: number) => void;
  intervalMs?: number;
}

export default function CinematicBackdrop({
  activeIndex,
  onIndexChange,
  intervalMs = 6500,
}: CinematicBackdropProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const currentIndex =
    typeof activeIndex === 'number' ? activeIndex : internalIndex;

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = (currentIndex + 1) % CINEMATIC_SCENES.length;
      if (typeof activeIndex !== 'number') {
        setInternalIndex(next);
      }
      onIndexChange?.(next);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [activeIndex, currentIndex, intervalMs, onIndexChange]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-zinc-950"
    >
      {CINEMATIC_SCENES.map((scene, idx) => {
        const isActive = idx === currentIndex;
        return (
          <div
            key={scene.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Ken Burns layer */}
            <img
              src={scene.image}
              alt={`${scene.city} — ${scene.district}`}
              className={`h-full w-full object-cover object-center ${
                isActive ? 'animate-kenburns' : 'scale-100'
              }`}
            />
            {/* Scene color tint */}
            <div
              className={`absolute inset-0 bg-gradient-to-tr ${scene.accent} via-transparent to-zinc-950/60`}
            />
          </div>
        );
      })}

      {/* Dark cinematic gradients & radial vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/45 to-zinc-950" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/55 to-zinc-950/75" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(9, 9, 11, 0.88) 100%)',
        }}
      />

      {/* Subtle scanlines */}
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px)',
        }}
      />
    </div>
  );
}
