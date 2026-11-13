'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { InventoryItem, PlayerWeapon } from '@/types/game';

interface InventoryResponse {
  inventory?: InventoryItem[];
  weapons?: PlayerWeapon[];
}

export default function InventoryPanel() {
  const { token } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [weapons, setWeapons] = useState<PlayerWeapon[]>([]);
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
      setMsg('Objeto equipado');
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function equipWeapon(weaponId: string) {
    try {
      await api.equipWeapon(weaponId);
      setMsg('Arma equipada');
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-amber-400">Inventario</h2>
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}

      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Objetos</h3>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">Vacío</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-medium">{it.template.name}</div>
                  <div className="text-xs text-zinc-500">
                    x{it.quantity} · {it.template.rarity}
                    {it.equipped ? ' · Equipado' : ''}
                  </div>
                </div>
                {!it.equipped && (
                  <button
                    type="button"
                    onClick={() => {
                      void equipItem(it.id);
                    }}
                    className="text-xs text-amber-400 underline"
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
