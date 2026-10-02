'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import CinematicBackdrop from '@/components/CinematicBackdrop';

export default function HomePage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const data = await api.post(path, { username, password });
      setAuth(data.accessToken, data.player);
      router.push('/play');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <CinematicBackdrop />
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-zinc-700/80 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur">
        <h1 className="text-3xl font-bold tracking-tight text-amber-400">VidaLoca</h1>
        <p className="mt-1 text-sm text-zinc-400">Mundo libre. Tú decides quién eres.</p>

        <div className="mt-6 flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-lg py-2 ${
              mode === 'login' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 rounded-lg py-2 ${
              mode === 'register' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400'
            }`}
          >
            Registrarse
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <input
            type="password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? '…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </main>
  );
}
