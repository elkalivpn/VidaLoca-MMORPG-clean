'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { PlayerProperty, PropertyTemplate } from '@/types/game';

export function PropertiesPanel({ onChange }: { onChange?: () => void }) {
  const [catalog, setCatalog] = useState<PropertyTemplate[]>([]);
  const [mine, setMine] = useState<PlayerProperty[]>([]);
  const [tab, setTab] = useState<'owned' | 'market'>('owned');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lastRent, setLastRent] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const [c, m] = await Promise.all([
        api.propertyCatalog() as Promise<PropertyTemplate[]>,
        api.myProperties() as Promise<PlayerProperty[]>,
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
      await api.buyProperty(id);
      await load();
      onChange?.();
      setTab('owned');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const collect = async (id: string) => {
    setBusy(id);
    setError('');
    try {
      const res: any = await api.collectRent(id);
      setLastRent(`+${res.rent}€ cobrados`);
      onChange?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="card text-zinc-500 animate-pulse">Cargando propiedades...</div>;
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Propiedades</h2>
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setTab('owned')}
            className={`px-3 py-1 text-sm rounded-md ${
              tab === 'owned' ? 'bg-amber-600 text-black' : 'text-zinc-400'
            }`}
          >
            Mis propiedades
          </button>
          <button
            type="button"
            onClick={() => setTab('market')}
            className={`px-3 py-1 text-sm rounded-md ${
              tab === 'market' ? 'bg-amber-600 text-black' : 'text-zinc-400'
            }`}
          >
            Mercado
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-3 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {lastRent && (
        <p className="text-emerald-400 text-sm mb-3">{lastRent}</p>
      )}

      {tab === 'owned' && (
        <div className="space-y-3 max-h-[420px] overflow-y-auto">
          {mine.length === 0 && (
            <p className="text-zinc-500 text-sm">Aún no tienes propiedades. Invierte.</p>
          )}
          {mine.map((p) => (
            <div
              key={p.id}
              className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3"
            >
              <div>
                <h3 className="font-semibold">{p.template.name}</h3>
                <p className="text-xs text-zinc-500">
                  {p.template.location} · {p.template.type} · Seguridad {p.template.security}
                </p>
                {p.template.rentYield != null && (
                  <p className="text-xs text-emerald-500/80 mt-0.5">
                    Rentabilidad {(p.template.rentYield * 100).toFixed(1)}%
                  </p>
                )}
              </div>
              {p.template.rentYield != null && p.template.rentYield > 0 && (
                <button
                  type="button"
                  onClick={() => collect(p.id)}
                  disabled={!!busy}
                  className="btn-primary text-sm"
                >
                  Cobrar alquiler
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'market' && (
        <div className="space-y-3 max-h-[420px] overflow-y-auto">
          {catalog.map((p) => (
            <div
              key={p.id}
              className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3"
            >
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-xs text-zinc-500">
                  {p.location} · {p.type} · Cap {p.capacity}
                </p>
                <p className="text-sm text-emerald-400 mt-1">
                  {p.priceEuros.toLocaleString('es-ES')} €
                  {p.priceVida != null && (
                    <span className="text-amber-400 ml-2">{p.priceVida} VC</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => buy(p.id)}
                disabled={busy === p.id}
                className="btn-primary text-sm shrink-0"
              >
                {busy === p.id ? '...' : 'Comprar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
