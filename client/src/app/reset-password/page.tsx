'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const paramToken = searchParams.get('token')?.trim() ?? '';
    if (paramToken) {
      setToken(paramToken);
    }
  }, [searchParams]);

  const passwordValid =
    newPassword.length >= 8 && /^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (token.trim().length < 32) {
      setError(
        'El token de recuperación es inválido o está incompleto. Abre el enlace completo de tu correo.',
      );
      return;
    }

    if (!passwordValid) {
      setError(
        'La nueva contraseña debe tener al menos 8 caracteres e incluir una letra y un número.',
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetPassword({
        token: token.trim(),
        newPassword,
      });
      setSuccessMsg(res.message);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo restablecer la contraseña.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" />
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/#portal"
              className="text-xs font-bold text-zinc-400 transition hover:text-amber-300"
            >
              ← Ir a iniciar sesión
            </Link>
            <span className="rounded border border-rose-500/50 bg-rose-600/20 px-2 py-0.5 text-[10px] font-black text-rose-300">
              +18 · ACCESO
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-white">
            Nueva Contraseña
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            Define una nueva clave segura. Al confirmarla se cerrarán todas las
            sesiones anteriores abiertas por seguridad.
          </p>

          {successMsg ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-xl border border-emerald-500/40 bg-emerald-950/35 px-4 py-3 text-xs leading-relaxed text-emerald-200">
                {successMsg}
              </p>
              <Link
                href="/#portal"
                className="block w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 text-center text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-400"
              >
                Iniciar Sesión Ahora →
              </Link>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              className="mt-6 space-y-4"
            >
              {!searchParams.get('token') && (
                <div>
                  <label
                    htmlFor="reset-token"
                    className="mb-1 block text-[11px] font-semibold text-zinc-400"
                  >
                    Token de recuperación
                  </label>
                  <input
                    id="reset-token"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Pega aquí el token de 64 caracteres"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 font-mono text-xs text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400"
                  />
                </div>
              )}

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label
                    htmlFor="reset-password"
                    className="block text-[11px] font-semibold text-zinc-400"
                  >
                    Nueva contraseña
                  </label>
                  <span
                    className={`text-[10px] font-semibold ${
                      newPassword.length === 0
                        ? 'text-zinc-500'
                        : passwordValid
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                    }`}
                  >
                    {newPassword.length === 0
                      ? 'Mín. 8 car. (letra + número)'
                      : passwordValid
                        ? '✓ Contraseña segura'
                        : newPassword.length < 8
                          ? `Faltan ${8 - newPassword.length} caracteres`
                          : 'Incluye letra y número'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-3.5 pr-20 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-zinc-700 bg-zinc-800/90 px-2 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-amber-400 hover:text-white"
                  >
                    {showPassword ? '🙈 Ocultar' : '👁️ Ver'}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="reset-confirm-password"
                  className="mb-1 block text-[11px] font-semibold text-zinc-400"
                >
                  Confirmar nueva contraseña
                </label>
                <input
                  id="reset-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
              >
                {loading ? 'Actualizando clave…' : 'Guardar Nueva Contraseña'}
              </button>
            </form>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-4 text-[11px] text-zinc-400">
            <Link href="/forgot-password" className="hover:text-amber-300">
              Solicitar otro enlace
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-xs text-zinc-400">
          Cargando formulario seguro de restablecimiento…
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
