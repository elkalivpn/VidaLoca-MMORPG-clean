'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { PlayerProperty, PropertyTemplate } from '@/types/game';

export default function PropertiesPanel() {
  const { token, refreshPlayer } = useAuth();
  const [mine, setMine] = useState<PlayerProperty[]>([]);
  const [catalog, setCatalog] = useState<PropertyTemplate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [m, c] = await Promise.all([
        api.myProperties() as Promise<PlayerProperty[]>,
        api.propertyCatalog() as Promise<PropertyTemplate[]>,
      ]);
      setMine(Array.isArray(m) ? m : []);
      setCatalog(Array.isArray(c) ? c : []);
    } catch {
      setMine([]);
      setCatalog([]);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function buy(templateId: string) {
    if (!token) return;
    setBusy(templateId);
    setMsg('');
    try {
      await api.buyProperty(templateId);
      setMsg('Propiedad comprada');
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function collectRent(id: string) {
    if (!token) return;
    setBusy(id);
    setMsg('');
    try {
      await api.collectRent(id);
      setMsg('Renta cobrada');
      await refreshPlayer();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-amber-400">Propiedades</h2>
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}

      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">
          Mis propiedades
        </h3>
        {mine.length === 0 ? (
          <p className="text-sm text-zinc-500">Ninguna</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-medium">{p.template.name}</div>
                  <div className="text-xs text-zinc-500">
                    {p.template.location} · {p.template.type}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => {
                    void collectRent(p.id);
                  }}
                  className="text-xs text-emerald-400 underline disabled:opacity-50"
                >
                  Cobrar renta
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {catalog.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">
            Inmobiliaria
          </h3>
          <ul className="space-y-2">
            {catalog.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-zinc-500">
                    {t.location} · Cap {t.capacity} · Seg {t.security}
                  </div>
                  <div className="text-xs text-emerald-400 mt-0.5">
                    {t.priceEuros.toLocaleString('es-ES')} €
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => {
                    void buy(t.id);
                  }}
                  className="text-xs text-amber-400 underline disabled:opacity-50"
                >
                  Comprar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
