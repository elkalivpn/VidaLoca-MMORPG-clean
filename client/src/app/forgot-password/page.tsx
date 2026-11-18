'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResultMsg('');
    setDevResetUrl('');
    setLoading(true);
    try {
      const res = await api.forgotPassword(email.trim());
      setResultMsg(res.message);
      if (res.devResetUrl) {
        setDevResetUrl(res.devResetUrl);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar la solicitud. Inténtalo en un minuto.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-400" />
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/#portal"
              className="text-xs font-bold text-zinc-400 transition hover:text-amber-300"
            >
              ← Volver al acceso
            </Link>
            <span className="rounded border border-rose-500/50 bg-rose-600/20 px-2 py-0.5 text-[10px] font-black text-rose-300">
              +18 · SEGURIDAD
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-white">
            Recuperar Contraseña
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            Introduce el correo de tu cuenta permanente en{' '}
            <strong className="text-zinc-200">VidaLoca MMORPG</strong>. Te
            enviaremos un enlace seguro de un solo uso válido durante 30
            minutos.
          </p>

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="mt-6 space-y-4"
          >
            <div>
              <label
                htmlFor="forgot-email"
                className="mb-1 block text-[11px] font-semibold text-zinc-400"
              >
                Correo electrónico registrado
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vidaloca.es"
                autoComplete="email"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                {error}
              </p>
            )}

            {resultMsg && (
              <div className="space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3.5 py-3 text-xs text-emerald-200">
                <p>{resultMsg}</p>
                {devResetUrl && (
                  <p className="border-t border-emerald-500/25 pt-2 text-[11px] text-amber-300">
                    Entorno local sin SMTP/Resend:{' '}
                    <Link
                      href={devResetUrl.replace(/^https?:\/\/[^/]+/, '')}
                      className="font-bold underline hover:text-amber-200"
                    >
                      Abrir enlace de restablecimiento →
                    </Link>
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
            >
              {loading ? 'Enviando enlace…' : 'Enviar enlace de recuperación'}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-4 text-[11px] text-zinc-400">
            <Link href="/reset-password" className="hover:text-amber-300">
              ¿Ya tienes un código o enlace?
            </Link>
            <div className="flex gap-3">
              <Link href="/terms" className="hover:text-zinc-200">
                Términos (+18)
              </Link>
              <Link href="/privacy" className="hover:text-zinc-200">
                Privacidad
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
