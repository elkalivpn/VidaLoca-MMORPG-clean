'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { PlayerVehicle, VehicleTemplate } from '@/types/game';

export function VehiclesPanel({ onChange }: { onChange?: () => void }) {
  const [catalog, setCatalog] = useState<VehicleTemplate[]>([]);
  const [mine, setMine] = useState<PlayerVehicle[]>([]);
  const [tab, setTab] = useState<'garage' | 'shop'>('garage');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [c, m] = await Promise.all([
        api.vehicleCatalog() as Promise<VehicleTemplate[]>,
        api.myVehicles() as Promise<PlayerVehicle[]>,
      ]);
      setCatalog(c || []);
      setMine(m || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const buy = async (id: string) => {
    setBusy(id);
    setError('');
    try {
      await api.buyVehicle(id);
      await load();
      onChange?.();
      setTab('garage');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const setPrimary = async (id: string) => {
    setBusy(id);
    try {
      await api.setPrimaryVehicle(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const repair = async (id: string) => {
    setBusy(id);
    try {
      await api.repairVehicle(id);
      await load();
      onChange?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="card text-zinc-500 animate-pulse">Cargando garaje...</div>;
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
            Concesionario
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
            <p className="text-zinc-500 text-sm">Tu garaje está vacío. Compra algo con estilo.</p>
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
                  {v.isPrimary && (
                    <span className="text-[10px] bg-amber-600/20 text-amber-400 px-1.5 py-0.5 rounded">
                      PRINCIPAL
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {v.licensePlate} · {v.color} · Estado {Math.round(v.condition)}%
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Vel {v.template.speed} · Manejo {v.template.handling}
                </p>
              </div>
              <div className="flex gap-2">
                {!v.isPrimary && (
                  <button
                    type="button"
                    onClick={() => setPrimary(v.id)}
                    disabled={!!busy}
                    className="btn-secondary text-sm"
                  >
                    Usar
                  </button>
                )}
                {v.condition < 100 && (
                  <button
                    type="button"
                    onClick={() => repair(v.id)}
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
          {catalog.map((v) => (
            <div
              key={v.id}
              className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3"
            >
              <div>
                <h3 className="font-semibold">
                  {v.brand} {v.name}
                </h3>
                <p className="text-xs text-zinc-500">
                  Vel {v.speed} · Manejo {v.handling} · Cap {v.capacity}
                </p>
                <p className="text-sm mt-1">
                  {v.priceEuros != null && (
                    <span className="text-emerald-400">
                      {v.priceEuros.toLocaleString('es-ES')} €
                    </span>
                  )}
                  {v.priceVida != null && (
                    <span className="text-amber-400 ml-2">{v.priceVida} VC</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => buy(v.id)}
                disabled={busy === v.id}
                className="btn-primary text-sm shrink-0"
              >
                {busy === v.id ? '...' : 'Comprar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
