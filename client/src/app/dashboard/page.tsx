'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';

export default function DashboardPage() {
  const router = useRouter();
  const { token, player } = useAuth();

  useEffect(() => {
    if (!token) {
      router.replace('/');
      return;
    }
    router.replace('/play');
  }, [token, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <p className="text-zinc-400">Entrando a la calle…</p>
      {player && <p className="sr-only">{player.username}</p>}
    </main>
  );
}
