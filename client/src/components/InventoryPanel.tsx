'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { InventoryItem, ItemTemplate, PlayerWeapon } from '@/types/game';

interface InventoryResponse {
  inventory?: InventoryItem[];
  weapons?: PlayerWeapon[];
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  ALL: 'Todos',
  CHARACTER: '🎭 Personaje',
  CLOTHING: '👔 Vestimenta',
  WEAPON: '🔫 Arma',
  COSMETIC: '✨ Cosmético',
  CONSUMABLE: '⚡ Gadget',
  SKILL_CARD: '📜 Carta',
  VEHICLE: '🔧 Tuning',
};

export default function InventoryPanel() {
  const { token, player, refreshPlayer } = useAuth();
  const [tab, setTab] = useState<'bag' | 'shop'>('bag');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [weapons, setWeapons] = useState<PlayerWeapon[]>([]);
  const [catalog, setCatalog] = useState<ItemTemplate[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [data, shopData] = await Promise.all([
        api.inventory() as Promise<InventoryResponse>,
        api.inventoryShop() as Promise<ItemTemplate[]>,
      ]);
      setItems(Array.isArray(data?.inventory) ? data.inventory : []);
      setWeapons(Array.isArray(data?.weapons) ? data.weapons : []);
      setCatalog(Array.isArray(shopData) ? shopData : []);
    } catch {
      setItems([]);
      setWeapons([]);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function equipItem(itemId: string) {
    setBusyId(`equip:${itemId}`);
    setMsg(null);
    try {
      await api.equipItem(itemId);
      setMsg({
        text: 'Objeto equipado en su ranura correspondiente.',
        ok: true,
      });
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function unequipItem(itemId: string) {
    setBusyId(`unequip:${itemId}`);
    setMsg(null);
    try {
      await api.unequipItem(itemId);
      setMsg({ text: 'Objeto desequipado.', ok: true });
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function consumeItem(itemId: string) {
    setBusyId(`use:${itemId}`);
    setMsg(null);
    try {
      const res = await api.useItem(itemId);
      setMsg({ text: res.message || 'Objeto utilizado.', ok: true });
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function equipWeapon(weaponId: string) {
    setBusyId(`weapon:${weaponId}`);
    setMsg(null);
    try {
      await api.equipWeapon(weaponId);
      setMsg({ text: 'Arma equipada.', ok: true });
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Error', ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function buyItem(templateId: string, currency: 'EUR' | 'VIDACOIN') {
    setBusyId(`buy:${templateId}:${currency}`);
    setMsg(null);
    try {
      const res = await api.buyInventoryItem(templateId, 1, currency);
      setMsg({ text: res.message || 'Compra realizada.', ok: true });
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg({
        text: e instanceof Error ? e.message : 'Error al comprar',
        ok: false,
      });
    } finally {
      setBusyId(null);
    }
  }

  const equippedChar = items.find(
    (i) => i.equipped && i.template.type === 'CHARACTER',
  );
  const equippedClothing = items.find(
    (i) => i.equipped && i.template.type === 'CLOTHING',
  );
  const equippedCosmetic = items.find(
    (i) => i.equipped && i.template.type === 'COSMETIC',
  );

  const visibleItems =
    typeFilter === 'ALL'
      ? items
      : items.filter((it) => it.template.type === typeFilter);

  const purchasableCatalog = catalog.filter(
    (tpl) => (tpl.priceEuros ?? 0) > 0 || (tpl.priceVida ?? 0) > 0,
  );
  const visibleCatalog =
    typeFilter === 'ALL'
      ? purchasableCatalog
      : purchasableCatalog.filter((tpl) => tpl.type === typeFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-amber-400">
          Inventario &amp; Tienda Urbana
        </h2>
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1 border border-zinc-800">
          <button
            type="button"
            onClick={() => setTab('bag')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              tab === 'bag'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Mochila ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('shop')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              tab === 'shop'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Tienda Urbana ({purchasableCatalog.length})
          </button>
        </div>
      </div>

      {/* Equipped Loadout Summary */}
      <div className="grid gap-2 sm:grid-cols-3 text-xs">
        <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-950/15 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-fuchsia-300">
            🎭 Personaje Activo
          </div>
          <div className="mt-0.5 font-semibold text-zinc-100">
            {equippedChar ? equippedChar.template.name : 'Operador Estándar'}
          </div>
        </div>
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/15 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-cyan-300">
            👔 Vestimenta Activa
          </div>
          <div className="mt-0.5 font-semibold text-zinc-100">
            {equippedClothing
              ? equippedClothing.template.name
              : 'Ropa de calle'}
          </div>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-amber-300">
            ✨ Cosmético Activo
          </div>
          <div className="mt-0.5 font-semibold text-zinc-100">
            {equippedCosmetic
              ? equippedCosmetic.template.name
              : 'Sin cosmético'}
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            msg.ok
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Shared Category Filter */}
      <div className="flex flex-wrap gap-1">
        {Object.entries(ITEM_TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTypeFilter(key)}
            className={`rounded border px-2 py-0.5 text-[11px] transition ${
              typeFilter === key
                ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'bag' ? (
        <>
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">
              Objetos ({visibleItems.length})
            </h3>
            {visibleItems.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No hay objetos en esta categoría. Visita la Tienda Urbana o el
                Mercado / Club VIP.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {visibleItems.map((it) => {
                  const isUsable =
                    it.template.type === 'CONSUMABLE' ||
                    it.template.type === 'SKILL_CARD';
                  return (
                    <li
                      key={it.id}
                      className={`rounded-lg border p-3 text-sm flex items-center justify-between gap-2 ${
                        it.equipped
                          ? 'border-amber-500/50 bg-amber-950/15'
                          : 'border-zinc-800 bg-zinc-900/50'
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                            {ITEM_TYPE_LABELS[it.template.type] ??
                              it.template.type}
                          </span>
                          <span className="font-medium">
                            {it.template.name}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          x{it.quantity} · {it.template.rarity}
                          {it.equipped ? ' · ✅ Equipado' : ''}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {isUsable && (
                          <button
                            type="button"
                            disabled={!!busyId}
                            onClick={() => {
                              void consumeItem(it.id);
                            }}
                            className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                          >
                            {busyId === `use:${it.id}` ? '…' : 'Usar'}
                          </button>
                        )}
                        {it.equipped ? (
                          <button
                            type="button"
                            disabled={!!busyId}
                            onClick={() => {
                              void unequipItem(it.id);
                            }}
                            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
                          >
                            {busyId === `unequip:${it.id}` ? '…' : 'Quitar'}
                          </button>
                        ) : (
                          !isUsable && (
                            <button
                              type="button"
                              disabled={!!busyId}
                              onClick={() => {
                                void equipItem(it.id);
                              }}
                              className="text-xs text-amber-400 underline disabled:opacity-50"
                            >
                              {busyId === `equip:${it.id}` ? '…' : 'Equipar'}
                            </button>
                          )
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {weapons.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-2">
                Armas desbloqueadas
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {weapons.map((w) => (
                  <li
                    key={w.id}
                    className={`rounded-lg border p-3 text-sm flex items-center justify-between gap-2 ${
                      w.equipped
                        ? 'border-amber-500/50 bg-amber-950/15'
                        : 'border-zinc-800 bg-zinc-900/50'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-zinc-500">
                        Daño {w.damage} · Alcance {w.range} · Precisión{' '}
                        {w.accuracy}
                        {w.equipped ? ' · ✅ Equipada' : ''}
                      </div>
                    </div>
                    {!w.equipped && (
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => {
                          void equipWeapon(w.id);
                        }}
                        className="text-xs text-amber-400 underline disabled:opacity-50"
                      >
                        {busyId === `weapon:${w.id}` ? '…' : 'Equipar'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">
            Catálogo Tienda Urbana ({visibleCatalog.length})
          </h3>
          {visibleCatalog.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No hay artículos en esta categoría de tienda.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {visibleCatalog.map((tpl) => {
                const playerEuros = player?.euros ?? 0;
                const playerVc = player?.vidaCoins ?? 0;
                const canAffordEur =
                  tpl.priceEuros != null &&
                  tpl.priceEuros > 0 &&
                  playerEuros >= tpl.priceEuros;
                const canAffordVc =
                  tpl.priceVida != null &&
                  tpl.priceVida > 0 &&
                  playerVc >= tpl.priceVida;
                return (
                  <li
                    key={tpl.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                          {ITEM_TYPE_LABELS[tpl.type] ?? tpl.type}
                        </span>
                        <span className="font-medium text-zinc-100">
                          {tpl.name}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {tpl.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/70">
                      <span className="text-[11px] text-zinc-500">
                        {tpl.rarity}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {tpl.priceEuros != null && tpl.priceEuros > 0 && (
                          <button
                            type="button"
                            disabled={!!busyId || !canAffordEur}
                            title={
                              canAffordEur
                                ? `Comprar ${tpl.name}`
                                : `Faltan ${Math.ceil(tpl.priceEuros - playerEuros).toLocaleString('es-ES')} €`
                            }
                            onClick={() => {
                              void buyItem(tpl.id, 'EUR');
                            }}
                            className={`rounded border px-2.5 py-1 text-xs font-semibold transition ${
                              canAffordEur
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                            }`}
                          >
                            {busyId === `buy:${tpl.id}:EUR`
                              ? 'Comprando…'
                              : `Comprar · ${tpl.priceEuros.toLocaleString('es-ES')} €`}
                          </button>
                        )}
                        {tpl.priceVida != null && tpl.priceVida > 0 && (
                          <button
                            type="button"
                            disabled={!!busyId || !canAffordVc}
                            title={
                              canAffordVc
                                ? `Comprar ${tpl.name}`
                                : `Faltan ${tpl.priceVida - playerVc} VC`
                            }
                            onClick={() => {
                              void buyItem(tpl.id, 'VIDACOIN');
                            }}
                            className={`rounded border px-2.5 py-1 text-xs font-semibold transition ${
                              canAffordVc
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-50'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                            }`}
                          >
                            {busyId === `buy:${tpl.id}:VIDACOIN`
                              ? 'Comprando…'
                              : `Comprar · ${tpl.priceVida} VC`}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
