'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { PlayerProperty, PropertyTemplate } from '@/types/game';

export default function PropertiesPanel() {
  const { token, player, refreshPlayer } = useAuth();
  const [mine, setMine] = useState<PlayerProperty[]>([]);
  const [catalog, setCatalog] = useState<PropertyTemplate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const isVipActive = Boolean(
    player?.isVip &&
    (!player.vipExpiresAt ||
      new Date(player.vipExpiresAt).getTime() > Date.now()),
  );

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

  const PROPERTY_TYPE_LABELS: Record<string, string> = {
    APARTMENT: 'Piso Franco',
    MANSION: 'Mansión',
    GARAGE: 'Garaje',
    CLUB: 'Club',
    WAREHOUSE: 'Almacén',
  };

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
      const res = (await api.collectRent(id)) as {
        rent?: number;
        vipBonusApplied?: boolean;
      };
      const rentLabel =
        typeof res?.rent === 'number'
          ? `+${res.rent.toLocaleString('es-ES')} €${res.vipBonusApplied ? ' (👑 VIP +15%)' : ''}`
          : '';
      setMsg({
        text: rentLabel ? `Renta cobrada: ${rentLabel}.` : 'Renta cobrada.',
        ok: true,
      });
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
      const laundered = res?.launderedEuros ?? res?.dirtyLaundered;
      if (typeof laundered === 'number' && laundered > 0) {
        details.push(`${laundered.toLocaleString('es-ES')} € blanqueados`);
      }
      const earned = res?.earnedEuros ?? res?.cleanEuros ?? res?.bonusEuros;
      if (typeof earned === 'number' && earned > 0) {
        details.push(`+${earned.toLocaleString('es-ES')} €`);
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
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-zinc-300">
            Mis propiedades ({mine.length})
          </h3>
          {isVipActive && (
            <span className="text-[11px] font-semibold text-amber-300">
              👑 Bonus Club VIP activo: +15% renta por hora
            </span>
          )}
        </div>
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
                    <div className="flex items-center gap-1.5 font-medium">
                      {p.template.isVipOnly && (
                        <span className="rounded border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                          👑 VIP
                        </span>
                      )}
                      <span>{p.template.name}</span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {p.template.location} ·{' '}
                      {PROPERTY_TYPE_LABELS[p.template.type] || p.template.type}
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
            Inmobiliaria ({catalog.length})
          </h3>
          <ul className="space-y-2">
            {catalog.map((t) => {
              const vipLocked = Boolean(t.isVipOnly && !isVipActive);
              const playerEuros = player?.euros ?? 0;
              const playerVc = player?.vidaCoins ?? 0;
              const missingEuros =
                t.priceEuros > 0 && playerEuros < t.priceEuros
                  ? Math.ceil(t.priceEuros - playerEuros)
                  : 0;
              const missingVc =
                (t.priceVida ?? 0) > 0 && playerVc < (t.priceVida ?? 0)
                  ? (t.priceVida ?? 0) - playerVc
                  : 0;
              const cantAfford = missingEuros > 0 || missingVc > 0;
              return (
                <li
                  key={t.id}
                  className={`rounded-lg border p-3 text-sm flex items-center justify-between gap-2 ${
                    t.isVipOnly
                      ? 'border-amber-500/40 bg-amber-950/10'
                      : 'border-zinc-800 bg-zinc-900/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-medium">
                      {t.isVipOnly && (
                        <span className="rounded border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                          👑 SOLO VIP
                        </span>
                      )}
                      <span>{t.name}</span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {t.location} · Cap {t.capacity} · Seg {t.security}
                      {t.rentYield
                        ? ` · Renta ${t.rentYield > 1 ? `${t.rentYield.toLocaleString('es-ES')}€/h` : `${Math.round(t.rentYield * 100)}%`}`
                        : ''}
                    </div>
                    <div className="text-xs mt-0.5">
                      {t.priceEuros > 0 && (
                        <span className="text-emerald-400 mr-2">
                          {t.priceEuros.toLocaleString('es-ES')} €
                        </span>
                      )}
                      {t.priceVida != null && t.priceVida > 0 && (
                        <span className="text-amber-300 font-semibold">
                          + {t.priceVida} VC
                        </span>
                      )}
                    </div>
                  </div>
                  {vipLocked ? (
                    <span className="rounded border border-amber-500/40 bg-zinc-900 px-2.5 py-1 text-xs text-amber-300 shrink-0">
                      Requiere Club VIP
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === t.id || cantAfford}
                      onClick={() => {
                        void buy(t.id);
                      }}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold shrink-0 transition ${
                        cantAfford
                          ? 'border-zinc-800 bg-zinc-900 text-zinc-500 cursor-not-allowed'
                          : 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 disabled:opacity-50'
                      }`}
                    >
                      {busy === t.id
                        ? 'Comprando…'
                        : missingEuros > 0
                          ? `Faltan ${missingEuros.toLocaleString('es-ES')} €`
                          : missingVc > 0
                            ? `Faltan ${missingVc} VC`
                            : 'Comprar'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
