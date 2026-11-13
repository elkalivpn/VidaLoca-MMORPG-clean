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
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function getPropertyFunctionLabel(
    type: string,
    name: string,
  ): {
    actionHint: string;
    fallbackResult: string;
  } {
    const key = `${type} ${name}`.toUpperCase();
    if (
      key.includes('SAFEHOUSE') ||
      key.includes('PISO') ||
      key.includes('FRANCO')
    ) {
      return {
        actionHint: 'Piso Franco · Enfría nivel de calor',
        fallbackResult:
          'Te resguardas en el Piso Franco y enfrías tu nivel de calor.',
      };
    }
    if (
      key.includes('GARAGE') ||
      key.includes('GARAJE') ||
      key.includes('TALLER')
    ) {
      return {
        actionHint: 'Garaje · Repara tus vehículos',
        fallbackResult: 'Operas el Garaje y reparas tus vehículos.',
      };
    }
    if (key.includes('CLUB') || key.includes('DISCO') || key.includes('BAR')) {
      return {
        actionHint: 'Club · Blanquea dinero sucio',
        fallbackResult:
          'Usas el Club para blanquear dinero sucio a euros limpios.',
      };
    }
    if (
      key.includes('WAREHOUSE') ||
      key.includes('ALMACEN') ||
      key.includes('ALMACÉN')
    ) {
      return {
        actionHint: 'Almacén · Opera logística y contrabando',
        fallbackResult: 'Operas la logística del Almacén y generas beneficios.',
      };
    }
    return {
      actionHint: `${type} · Operación de propiedad`,
      fallbackResult: 'Propiedad utilizada con éxito.',
    };
  }

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
    setMsg(null);
    try {
      await api.buyProperty(templateId);
      setMsg({ text: 'Propiedad comprada con éxito.', ok: true });
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg({
        text: e instanceof Error ? e.message : 'Error al comprar propiedad',
        ok: false,
      });
    } finally {
      setBusy(null);
    }
  }

  async function collectRent(id: string) {
    if (!token) return;
    setBusy(`rent:${id}`);
    setMsg(null);
    try {
      await api.collectRent(id);
      setMsg({ text: 'Renta cobrada.', ok: true });
      await refreshPlayer();
    } catch (e: unknown) {
      setMsg({
        text: e instanceof Error ? e.message : 'Error al cobrar renta',
        ok: false,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleUseProperty(p: PlayerProperty) {
    if (!token) return;
    setBusy(`use:${p.id}`);
    setMsg(null);
    const meta = getPropertyFunctionLabel(p.template.type, p.template.name);
    try {
      const res = await api.useProperty(p.id);
      const details: string[] = [];
      if (typeof res?.heatReduced === 'number' && res.heatReduced > 0) {
        details.push(`-${res.heatReduced} calor`);
      }
      if (typeof res?.repairedCount === 'number' && res.repairedCount > 0) {
        details.push(`${res.repairedCount} vehículo(s) reparado(s)`);
      }
      if (typeof res?.launderedEuros === 'number' && res.launderedEuros > 0) {
        details.push(
          `${res.launderedEuros.toLocaleString('es-ES')} € blanqueados`,
        );
      }
      if (typeof res?.earnedEuros === 'number' && res.earnedEuros > 0) {
        details.push(`+${res.earnedEuros.toLocaleString('es-ES')} €`);
      }
      const baseText = res?.message || res?.effect || meta.fallbackResult;
      const fullText =
        details.length > 0 ? `${baseText} (${details.join(' · ')})` : baseText;
      setMsg({ text: fullText, ok: true });
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg({
        text: e instanceof Error ? e.message : 'No se pudo usar la propiedad',
        ok: false,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-amber-400">Propiedades</h2>
      {msg && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            msg.ok
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">
          Mis propiedades
        </h3>
        {mine.length === 0 ? (
          <p className="text-sm text-zinc-500">Ninguna</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((p) => {
              const meta = getPropertyFunctionLabel(
                p.template.type,
                p.template.name,
              );
              const isRowBusy =
                busy === `use:${p.id}` || busy === `rent:${p.id}`;
              return (
                <li
                  key={p.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-medium">{p.template.name}</div>
                    <div className="text-xs text-zinc-500">
                      {p.template.location} · {p.template.type}
                    </div>
                    <div className="text-xs text-amber-300/80 mt-0.5">
                      {meta.actionHint}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isRowBusy}
                      onClick={() => {
                        void handleUseProperty(p);
                      }}
                      className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      {busy === `use:${p.id}` ? 'Usando…' : 'Usar Propiedad'}
                    </button>
                    <button
                      type="button"
                      disabled={isRowBusy}
                      onClick={() => {
                        void collectRent(p.id);
                      }}
                      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {busy === `rent:${p.id}` ? 'Cobrando…' : 'Cobrar renta'}
                    </button>
                  </div>
                </li>
              );
            })}
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
