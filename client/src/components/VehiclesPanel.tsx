'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { PlayerVehicle, VehicleTemplate } from '@/types/game';

export function VehiclesPanel({ onChange }: { onChange?: () => void }) {
  const { player, refreshPlayer } = useAuth();
  const [catalog, setCatalog] = useState<VehicleTemplate[]>([]);
  const [mine, setMine] = useState<PlayerVehicle[]>([]);
  const [tab, setTab] = useState<'garage' | 'shop'>('garage');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isVipActive = Boolean(
    player?.isVip &&
    (!player.vipExpiresAt ||
      new Date(player.vipExpiresAt).getTime() > Date.now()),
  );

  const load = async () => {
    setLoading(true);
    try {
      const [c, m] = await Promise.all([
        api.vehicleCatalog() as Promise<VehicleTemplate[]>,
        api.myVehicles() as Promise<PlayerVehicle[]>,
      ]);
      setCatalog(c || []);
      setMine(m || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const buy = async (id: string, currency?: 'EUR' | 'VIDACOIN') => {
    setBusy(`${id}:${currency ?? 'default'}`);
    setError('');
    try {
      await api.buyVehicle(id, undefined, currency);
      await Promise.all([load(), refreshPlayer()]);
      onChange?.();
      setTab('garage');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  };

  const setPrimary = async (id: string) => {
    setBusy(id);
    setError('');
    try {
      await api.setPrimaryVehicle(id);
      await Promise.all([load(), refreshPlayer()]);
      onChange?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  };

  const repair = async (id: string) => {
    setBusy(id);
    try {
      await api.repairVehicle(id);
      await Promise.all([load(), refreshPlayer()]);
      onChange?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="card text-zinc-500 animate-pulse">Cargando garaje...</div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Vehículos</h2>
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setTab('garage')}
            className={`px-3 py-1 text-sm rounded-md ${
              tab === 'garage' ? 'bg-amber-600 text-black' : 'text-zinc-400'
            }`}
          >
            Garaje ({mine.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('shop')}
            className={`px-3 py-1 text-sm rounded-md ${
              tab === 'shop' ? 'bg-amber-600 text-black' : 'text-zinc-400'
            }`}
          >
            Concesionario ({catalog.length})
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-3 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {tab === 'garage' && (
        <div className="space-y-3 max-h-[420px] overflow-y-auto">
          {mine.length === 0 && (
            <p className="text-zinc-500 text-sm">
              Tu garaje está vacío. Compra algo con estilo.
            </p>
          )}
          {mine.map((v) => (
            <div
              key={v.id}
              className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">
                    {v.template.brand} {v.template.name}
                  </h3>
                  {v.template.isVipOnly && (
                    <span className="text-[10px] bg-amber-500/20 border border-amber-400/50 text-amber-200 px-1.5 py-0.5 rounded font-bold">
                      👑 VIP
                    </span>
                  )}
                  {v.isPrimary && (
                    <span className="text-[10px] bg-amber-600/20 text-amber-400 px-1.5 py-0.5 rounded">
                      PRINCIPAL
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {v.licensePlate} · {v.color} · Estado{' '}
                  {Math.round(v.condition)}%
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Vel {v.template.speed} · Manejo {v.template.handling}
                </p>
              </div>
              <div className="flex gap-2">
                {!v.isPrimary && (
                  <button
                    type="button"
                    onClick={() => {
                      void setPrimary(v.id);
                    }}
                    disabled={!!busy}
                    className="btn-secondary text-sm"
                  >
                    Usar
                  </button>
                )}
                {v.condition < 100 && (
                  <button
                    type="button"
                    onClick={() => {
                      void repair(v.id);
                    }}
                    disabled={!!busy}
                    className="btn-secondary text-sm"
                  >
                    Reparar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'shop' && (
        <div className="space-y-3 max-h-[420px] overflow-y-auto">
          {catalog.map((v) => {
            const vipLocked = Boolean(v.isVipOnly && !isVipActive);
            return (
              <div
                key={v.id}
                className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 ${
                  v.isVipOnly
                    ? 'border-amber-500/40 bg-amber-950/10'
                    : 'border-zinc-800 bg-zinc-900/60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    {v.isVipOnly && (
                      <span className="text-[10px] bg-amber-500/20 border border-amber-400/50 text-amber-200 px-1.5 py-0.5 rounded font-bold">
                        👑 SOLO VIP
                      </span>
                    )}
                    <h3 className="font-semibold">
                      {v.brand} {v.name}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Vel {v.speed} · Manejo {v.handling} · Dur {v.durability} ·
                    Cap {v.capacity}
                  </p>
                  <p className="text-sm mt-1">
                    {v.priceEuros != null && (
                      <span className="text-emerald-400 mr-2">
                        {v.priceEuros.toLocaleString('es-ES')} €
                      </span>
                    )}
                    {v.priceVida != null && (
                      <span className="text-amber-400 font-semibold">
                        {v.priceVida} VC
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {vipLocked ? (
                    <span className="rounded-md border border-amber-500/40 bg-zinc-900 px-3 py-1.5 text-xs text-amber-300">
                      Requiere Club VIP
                    </span>
                  ) : (
                    <>
                      {v.priceEuros != null && v.priceEuros > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            void buy(v.id, 'EUR');
                          }}
                          disabled={!!busy}
                          className="btn-primary text-xs shrink-0"
                        >
                          {busy === `${v.id}:EUR` ? '...' : 'Comprar €'}
                        </button>
                      )}
                      {v.priceVida != null && v.priceVida > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            void buy(v.id, 'VIDACOIN');
                          }}
                          disabled={!!busy}
                          className="rounded-md border border-amber-400/60 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                        >
                          {busy === `${v.id}:VIDACOIN`
                            ? '...'
                            : `${v.priceVida} VC`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
