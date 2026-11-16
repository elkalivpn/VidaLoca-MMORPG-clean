'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { AdminOverviewResponse } from '@/types/game';

export default function AdminPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const res = await api.adminOverview();
      setData(res);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Acceso restringido a administradores o moderadores.',
      );
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleBan(playerId: string, currentlyBanned: boolean) {
    setBusyId(`ban-${playerId}`);
    setMsg('');
    try {
      await api.adminBanPlayer(
        playerId,
        !currentlyBanned,
        !currentlyBanned ? 'Moderación desde /admin' : undefined,
      );
      setMsg(
        !currentlyBanned ? 'Jugador suspendido.' : 'Suspensión levantada.',
      );
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error al actualizar estado');
    } finally {
      setBusyId(null);
    }
  }

  async function grantSupport(
    playerId: string,
    days: number,
    vidaCoins: number,
  ) {
    setBusyId(`vip-${playerId}`);
    setMsg('');
    try {
      await api.adminGrantVip(playerId, {
        days,
        vidaCoins,
        reason: 'Soporte / Promo Admin',
      });
      setMsg(`Otorgados +${days} días VIP y +${vidaCoins} VC.`);
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error al otorgar VIP/VC');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-400 font-bold">
            VidaLoca Operations
          </p>
          <h1 className="text-2xl font-black text-white">
            Panel de Administración y Moderación
          </h1>
        </div>
        <Link
          href="/play"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold hover:border-amber-400"
        >
          ← Volver al Juego
        </Link>
      </header>

      {!token && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-4 text-sm text-amber-200">
          Inicia sesión con una cuenta con rol <strong>ADMIN</strong> o{' '}
          <strong>MODERATOR</strong> para acceder a este panel.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200">
          {error}
        </p>
      )}

      {msg && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
          {msg}
        </p>
      )}

      {data && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs text-zinc-400">Jugadores / Invitados</p>
              <p className="mt-1 text-2xl font-black text-white">
                {data.metrics.totalPlayers}{' '}
                <span className="text-xs font-normal text-zinc-400">
                  ({data.metrics.guestUsers} inv.)
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
              <p className="text-xs text-amber-300">Club VIP Activos</p>
              <p className="mt-1 text-2xl font-black text-amber-300">
                👑 {data.metrics.activeVipPlayers}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs text-zinc-400">Economía en Circulación</p>
              <p className="mt-1 text-lg font-bold text-emerald-400">
                {data.metrics.totalEurosInEconomy.toLocaleString('es-ES')} €
              </p>
              <p className="text-xs text-amber-300">
                {data.metrics.totalVidaCoinsInEconomy.toLocaleString('es-ES')}{' '}
                VC
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs text-zinc-400">Mercado P2P &amp; Clanes</p>
              <p className="mt-1 text-lg font-bold text-sky-300">
                {data.metrics.activeListings} anuncios ·{' '}
                {data.metrics.totalClans} clanes
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <h2 className="text-sm font-bold text-amber-400">
              Jugadores Recientes &amp; Soporte
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="py-2 pr-3">Jugador</th>
                    <th className="py-2 pr-3">Nivel</th>
                    <th className="py-2 pr-3">Saldo</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {data.recentPlayers.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-white">
                          {p.isVip ? '👑 ' : ''}
                          {p.displayName}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          @{p.user.username} · {p.user.role}
                          {p.user.isGuest ? ' · Invitado' : ''}
                        </div>
                      </td>
                      <td className="py-2 pr-3">Nv.{p.level}</td>
                      <td className="py-2 pr-3">
                        <div>
                          {Math.floor(p.euros).toLocaleString('es-ES')} €
                        </div>
                        <div className="text-amber-300">{p.vidaCoins} VC</div>
                      </td>
                      <td className="py-2 pr-3">
                        {p.user.isBanned ? (
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-300">
                            Baneado
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                            Activo
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right space-x-1.5">
                        <button
                          type="button"
                          disabled={busyId === `vip-${p.id}`}
                          onClick={() => {
                            void grantSupport(p.id, 7, 50);
                          }}
                          className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                        >
                          +7d VIP &amp; 50 VC
                        </button>
                        <button
                          type="button"
                          disabled={busyId === `ban-${p.id}`}
                          onClick={() => {
                            void toggleBan(p.id, p.user.isBanned);
                          }}
                          className="rounded border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/25 disabled:opacity-50"
                        >
                          {p.user.isBanned ? 'Desbanear' : 'Banear'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
            <h2 className="text-sm font-bold text-amber-400">
              Registro de Seguridad / Anti-Cheat
            </h2>
            {data.recentAuditLogs.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Sin incidentes registrados recientemente.
              </p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {data.recentAuditLogs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/70 px-3 py-1.5"
                  >
                    <span>
                      <strong className="text-amber-300">
                        [{log.severity}]
                      </strong>{' '}
                      {log.eventType} {log.target ? `· ${log.target}` : ''}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(log.createdAt).toLocaleString('es-ES')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
