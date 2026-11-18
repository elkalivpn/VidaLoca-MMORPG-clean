'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export const AGE_18_STORAGE_KEY = 'vidaloca_age_18_verified';

const ADULT_CONTENT_WARNINGS = [
  {
    icon: '🩸',
    title: 'Violencia Extrema & Sangre',
    detail:
      'Combates cuerpo a cuerpo, heridas realistas, ajustes de cuentas y brutalidad urbana sin filtros.',
  },
  {
    icon: '🔫',
    title: 'Peleas, Disparos & Persecuciones',
    detail:
      'Tiroteos armados entre facciones, atracos a mano armada y redadas policiales de alto impacto.',
  },
  {
    icon: '🍸',
    title: 'Escenas Adultas & Clubes Nocturnos',
    detail:
      'Locales privados, ambiente nocturno sin censura, lenguaje explícito y tramas adultas.',
  },
  {
    icon: '📦',
    title: 'Drogas & Contrabando',
    detail:
      'Rutas clandestinas, mercancía ilícita, laboratorios y operaciones del mercado negro.',
  },
  {
    icon: '🎰',
    title: 'Casino Clandestino & Apuestas',
    detail:
      'Mesas de juego ilegal, apuestas de alto riesgo y blanqueo de capitales ficticios.',
  },
];

interface AgeGateModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
  onVerifiedChange?: (verified: boolean) => void;
}

export default function AgeGateModal({
  forceOpen = false,
  onClose,
  onVerifiedChange,
}: AgeGateModalProps) {
  const [hydrated, setHydrated] = useState(false);
  const [verified, setVerified] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(AGE_18_STORAGE_KEY) === '1';
      setVerified(stored);
      setAutoOpen(!stored);
      onVerifiedChange?.(stored);
    } catch {
      setVerified(false);
      setAutoOpen(true);
    } finally {
      setHydrated(true);
    }
  }, [onVerifiedChange]);

  const isVisible = hydrated && (autoOpen || forceOpen);

  useEffect(() => {
    if (!isVisible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isVisible]);

  function handleConfirmAdult() {
    try {
      window.localStorage.setItem(AGE_18_STORAGE_KEY, '1');
    } catch {
      // Ignore storage failures in restricted browser modes
    }
    setVerified(true);
    setRestricted(false);
    setAutoOpen(false);
    onVerifiedChange?.(true);
    onClose?.();
  }

  function handleUnderageExit() {
    try {
      window.localStorage.removeItem(AGE_18_STORAGE_KEY);
    } catch {
      // Ignore storage failures
    }
    setVerified(false);
    setRestricted(true);
    onVerifiedChange?.(false);
  }

  function handleCloseIfVerified() {
    if (!verified) return;
    setRestricted(false);
    setAutoOpen(false);
    onClose?.();
  }

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 p-4 backdrop-blur-xl"
    >
      <div className="animate-modal-in relative w-full max-w-2xl overflow-hidden rounded-3xl border border-rose-500/40 bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950 shadow-2xl shadow-rose-950/50">
        {/* Top glowing bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-600 via-amber-500 to-fuchsia-600" />

        <div className="max-h-[90vh] overflow-y-auto p-6 sm:p-8">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src="/images/vidaloca-logo.png"
                alt="VidaLoca MMORPG"
                className="h-12 w-12 rounded-xl border border-amber-500/40 bg-zinc-900 object-cover shadow-lg shadow-amber-500/15"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/60 bg-rose-600 px-2 py-0.5 text-xs font-black tracking-wider text-white shadow-sm shadow-rose-600/40">
                    +18
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                    Clasificación Adultos · Sin Censura
                  </span>
                </div>
                <h2
                  id="age-gate-title"
                  className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl"
                >
                  Verificación de Edad Obligatoria
                </h2>
              </div>
            </div>

            {verified && !restricted && (
              <button
                type="button"
                onClick={handleCloseIfVerified}
                aria-label="Cerrar aviso +18"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                ✕ Cerrar
              </button>
            )}
          </div>

          {restricted ? (
            <div className="mt-6 space-y-5 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/50 bg-rose-600/20 text-2xl font-black text-rose-300">
                +18
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">
                  Acceso Restringido a Menores de 18 Años
                </h3>
                <p className="mx-auto max-w-md text-sm leading-relaxed text-zinc-300">
                  <strong>VidaLoca MMORPG</strong> incluye contenido explícito
                  para adultos: violencia, sangre, disparos, clubes nocturnos,
                  contrabando y casino clandestino. Debes ser mayor de edad para
                  acceder a la experiencia.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <a
                  href="https://www.google.es"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-rose-500/50 bg-rose-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-rose-500"
                >
                  Abandonar este Sitio
                </a>
                <button
                  type="button"
                  onClick={() => setRestricted(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-bold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  Volver a Verificación
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-4 text-sm leading-relaxed text-zinc-300">
                Estás accediendo a{' '}
                <strong className="text-white">VidaLoca MMORPG</strong>, un
                mundo abierto urbano ambientado en España con estética
                cinematográfica cruda y temática estrictamente{' '}
                <span className="font-bold text-rose-400">
                  para mayores de 18 años (+18)
                </span>
                . Antes de continuar, confirma que cumples la edad legal en tu
                país.
              </p>

              {/* Explicit warning grid */}
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {ADULT_CONTENT_WARNINGS.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-base">
                        {item.icon}
                      </span>
                      <p className="text-xs font-black text-amber-300">
                        {item.title}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                      {item.detail}
                    </p>
                  </div>
                ))}
                <div className="flex flex-col justify-center rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
                  <p className="text-xs font-black text-emerald-300">
                    {verified
                      ? '✓ Edad +18 Verificada en este Navegador'
                      : '🔒 Verificación Local Segura'}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                    Tu confirmación se guarda localmente en tu navegador y
                    puedes revisar estos detalles en cualquier momento desde el
                    badge <span className="font-bold text-rose-300">+18</span>.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleConfirmAdult}
                  className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 via-amber-500 to-amber-400 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110"
                >
                  Tengo +18 años · Entrar a VidaLoca
                </button>
                <button
                  type="button"
                  onClick={handleUnderageExit}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:border-rose-500/60 hover:bg-rose-950/40 hover:text-rose-200"
                >
                  Soy menor de 18 · Salir
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-400">
                <Link
                  href="/terms"
                  onClick={handleCloseIfVerified}
                  className="underline decoration-zinc-600 underline-offset-2 transition hover:text-amber-300"
                >
                  Términos de Uso (+18)
                </Link>
                <span aria-hidden="true">·</span>
                <Link
                  href="/privacy"
                  onClick={handleCloseIfVerified}
                  className="underline decoration-zinc-600 underline-offset-2 transition hover:text-amber-300"
                >
                  Política de Privacidad y RGPD
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
