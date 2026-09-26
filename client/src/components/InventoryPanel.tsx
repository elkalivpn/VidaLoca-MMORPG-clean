'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface ItemTemplate {
  id: string;
  name: string;
  description?: string;
  type?: string;
  rarity?: string;
}

interface InventoryItem {
  id: string;
  quantity: number;
  equipped: boolean;
  template: ItemTemplate;
}

interface PlayerWeapon {
  id: string;
  name: string;
  damage: number;
  range: number;
  accuracy: number;
  equipped: boolean;
}

const RARITY: Record<string, string> = {
  COMMON: 'text-zinc-300 border-zinc-600',
  RARE: 'text-sky-300 border-sky-700',
  EPIC: 'text-purple-300 border-purple-700',
  LEGENDARY: 'text-amber-300 border-amber-600',
};

export function InventoryPanel({ onChange }: { onChange?: () => void }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [weapons, setWeapons] = useState<PlayerWeapon[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = (await api.inventory()) as {
        inventory: InventoryItem[];
        weapons: PlayerWeapon[];
      };
      setItems(data.inventory || []);
      setWeapons(data.weapons || []);
    } catch (e: any) {
      setError(e.message || 'Error cargando inventario');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const equipItem = async (itemId: string) => {
    setBusy(true);
    setError('');
    setOk('');
    try {
      await api.equipItem(itemId);
      setOk('Ítem equipado');
      await load();
      onChange?.();
    } catch (e: any) {
      setError(e.message || 'No se pudo equipar');
    } finally {
      setBusy(false);
    }
  };

  const equipWeapon = async (weaponId: string) => {
    setBusy(true);
    setError('');
    setOk('');
    try {
      await api.equipWeapon(weaponId);
      setOk('Arma equipada');
      await load();
      onChange?.();
    } catch (e: any) {
      setError(e.message || 'No se pudo equipar el arma');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <p className="text-zinc-500 animate-pulse">Cargando inventario...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {ok && (
        <p className="text-emerald-400 text-sm bg-emerald-950/40 border border-emerald-900 rounded-lg px-3 py-2">
          {ok}
        </p>
      )}

      <div className="card">
        <h2 className="text-lg font-bold mb-3">Inventario</h2>
        {items.length === 0 ? (
          <p className="text-zinc-600 text-sm">
            Vacío. Completa misiones y compra en el mercado para llenarlo.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => {
              const rarity = item.template?.rarity || 'COMMON';
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border bg-zinc-900/60 p-3 ${RARITY[rarity] || RARITY.COMMON}`}
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold truncate">{item.template?.name}</p>
                    <span className="text-xs opacity-70 shrink-0">x{item.quantity}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                    {item.template?.description || item.template?.type || 'Ítem'}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider opacity-60">
                      {rarity}
                    </span>
                    {item.equipped ? (
                      <span className="text-xs text-emerald-400">Equipado</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => equipItem(item.id)}
                        className="btn-secondary text-xs py-1 px-2"
                      >
                        Equipar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-3">Armas</h2>
        {weapons.length === 0 ? (
          <p className="text-zinc-600 text-sm">Sin armas. Consíguelas en misiones o el mercado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {weapons.map((w) => (
              <div
                key={w.id}
                className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-3"
              >
                <p className="font-semibold text-zinc-100">{w.name}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Daño {w.damage} · Alcance {w.range} · Precisión {w.accuracy}
                </p>
                <div className="mt-2 flex justify-end">
                  {w.equipped ? (
                    <span className="text-xs text-emerald-400">Equipada</span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => equipWeapon(w.id)}
                      className="btn-secondary text-xs py-1 px-2"
                    >
                      Equipar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
