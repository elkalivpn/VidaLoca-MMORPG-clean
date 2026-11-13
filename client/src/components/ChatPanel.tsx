'use client';

import { useState } from 'react';
import type { ChatMessage } from '@/lib/socket';

export default function ChatPanel({
  messages,
  onSend,
}: {
  messages: ChatMessage[];
  onSend: (text: string, scope: 'zone' | 'global') => void;
}) {
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'zone' | 'global'>('zone');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim(), scope);
    setText('');
  }

  return (
    <div className="flex h-full min-h-[240px] flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Chat
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 p-2 text-sm">
        {messages.length === 0 && (
          <p className="text-zinc-600 text-xs">Sin mensajes aún…</p>
        )}
        {messages.map((m, i) => (
          <div key={m.id || i} className="text-zinc-300">
            <span className="text-amber-400/90 font-medium">
              {m.displayName || 'sistema'}
            </span>
            {m.locationId && (
              <span className="text-zinc-600 text-xs ml-1">
                [{m.locationId}]
              </span>
            )}
            {m.channel === 'global' && (
              <span className="text-sky-400/80 text-xs ml-1">[Global]</span>
            )}
            <span className="text-zinc-500">: </span>
            {m.message}
            {m.timestamp && (
              <span className="text-zinc-600 text-[10px] ml-1.5">
                {new Date(m.timestamp).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        ))}
      </div>
      <form
        onSubmit={submit}
        className="flex gap-1 border-t border-zinc-800 p-2"
      >
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as 'zone' | 'global')}
          className="rounded border border-zinc-700 bg-zinc-950 text-xs px-1"
        >
          <option value="zone">Zona</option>
          <option value="global">Global</option>
        </select>
        <input
          className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe…"
        />
        <button
          type="submit"
          className="rounded bg-zinc-700 px-2 text-xs hover:bg-zinc-600"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
