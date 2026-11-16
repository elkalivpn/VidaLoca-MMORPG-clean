'use client';

import { useState } from 'react';
import type { ChatMessage } from '@/lib/socket';

export default function ChatPanel({
  messages,
  connected = true,
  onSend,
}: {
  messages: ChatMessage[];
  connected?: boolean;
  onSend: (
    text: string,
    scope: 'zone' | 'global',
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
}) {
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'zone' | 'global'>('zone');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !connected || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await onSend(trimmed, scope);
      if (res && res.ok === false) {
        setError(res.error || 'No se pudo enviar');
      } else {
        setText('');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de envío');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-[240px] flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        <span>Chat</span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-medium normal-case ${
            connected ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
            }`}
          />
          {connected ? 'En vivo' : 'Reconectando…'}
        </span>
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
      {error && (
        <div className="border-t border-red-500/30 bg-red-950/40 px-2.5 py-1 text-[11px] text-red-300">
          {error}
        </div>
      )}
      <form
        onSubmit={(e) => {
          void submit(e);
        }}
        className="flex gap-1 border-t border-zinc-800 p-2"
      >
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as 'zone' | 'global')}
          disabled={!connected}
          className="rounded border border-zinc-700 bg-zinc-950 text-xs px-1 disabled:opacity-50"
        >
          <option value="zone">Zona</option>
          <option value="global">Global</option>
        </select>
        <input
          className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm disabled:opacity-50"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!connected}
          placeholder={connected ? 'Escribe…' : 'Esperando WebSocket…'}
        />
        <button
          type="submit"
          disabled={!connected || sending || !text.trim()}
          className="rounded bg-zinc-700 px-2 text-xs hover:bg-zinc-600 disabled:opacity-50"
        >
          {sending ? '…' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
