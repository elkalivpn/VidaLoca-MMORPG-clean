'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function InventoryPanel() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    api
      .get('/inventory', token)
      .then((data) => setItems(Array.isArray(data) ? data : data.items || []))
      .catch(() => setItems([]));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-amber-400">Inventario</h2>
      {items.length === 0 && <p className="text-sm text-zinc-500">Vacío</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.id || it.itemId} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
            <div className="font-medium">{it.name || it.itemId}</div>
            <div className="text-xs text-zinc-500">x{it.quantity ?? 1}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
