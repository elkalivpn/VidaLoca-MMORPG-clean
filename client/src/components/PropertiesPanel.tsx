'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function PropertiesPanel() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    api
      .get('/properties', token)
      .then((data) => setItems(Array.isArray(data) ? data : data.properties || []))
      .catch(() => setItems([]));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-amber-400">Propiedades</h2>
      {items.length === 0 && <p className="text-sm text-zinc-500">Ninguna</p>}
      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
            <div className="font-medium">{p.name || p.propertyId}</div>
            <div className="text-xs text-zinc-500">{p.zoneId || p.location}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
