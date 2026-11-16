'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { InventoryItem, PlayerWeapon } from '@/types/game';

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
  const { token, refreshPlayer } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [weapons, setWeapons] = useState<PlayerWeapon[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = (await api.inventory()) as InventoryResponse;
      setItems(Array.isArray(data?.inventory) ? data.inventory : []);
      setWeapons(Array.isArray(data?.weapons) ? data.weapons : []);
    } catch {
      setItems([]);
      setWeapons([]);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function equipItem(itemId: string) {
    try {
      await api.equipItem(itemId);
      setMsg('Objeto equipado en su ranura correspondiente');
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function equipWeapon(weaponId: string) {
    try {
      await api.equipWeapon(weaponId);
      setMsg('Arma equipada');
      await Promise.all([load(), refreshPlayer()]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
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

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-amber-400">
        Inventario &amp; Equipamiento
      </h2>

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

      {msg && <p className="text-sm text-amber-300">{msg}</p>}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-zinc-300">
            Objetos ({visibleItems.length})
          </h3>
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
        </div>

        {visibleItems.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No hay objetos en esta categoría. Visita el Mercado / Club VIP o
            completa misiones.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {visibleItems.map((it) => (
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
                      {ITEM_TYPE_LABELS[it.template.type] ?? it.template.type}
                    </span>
                    <span className="font-medium">{it.template.name}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    x{it.quantity} · {it.template.rarity}
                    {it.equipped ? ' · ✅ Equipado' : ''}
                  </div>
                </div>
                {!it.equipped && (
                  <button
                    type="button"
                    onClick={() => {
                      void equipItem(it.id);
                    }}
                    className="text-xs text-amber-400 underline shrink-0"
                  >
                    Equipar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {weapons.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">Armas</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {weapons.map((w) => (
              <li
                key={w.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs text-zinc-500">
                    Daño {w.damage} · Alcance {w.range} · Precisión {w.accuracy}
                    {w.equipped ? ' · Equipada' : ''}
                  </div>
                </div>
                {!w.equipped && (
                  <button
                    type="button"
                    onClick={() => {
                      void equipWeapon(w.id);
                    }}
                    className="text-xs text-amber-400 underline"
                  >
                    Equipar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
