'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, WorldEvent, PresencePlayer } from '@/lib/socket';

interface Props {
  connected: boolean;
  messages: ChatMessage[];
  worldEvents: WorldEvent[];
  zonePlayers: PresencePlayer[];
  onlineTotal: number;
  onSendZone: (msg: string) => void;
  onSendGlobal: (msg: string) => void;
}

export function ChatPanel({
  connected,
  messages,
  worldEvents,
  zonePlayers,
  onlineTotal,
  onSendZone,
  onSendGlobal,
}: Props) {
  const [text, setText] = useState('');
  const [channel, setChannel] = useState<'zone' | 'global'>('zone');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, worldEvents]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || !connected) return;
    if (channel === 'zone') onSendZone(msg);
    else onSendGlobal(msg);
    setText('');
  };

  const feed = [
    ...worldEvents.map((ev) => ({
      kind: 'event' as const,
      id: `ev-${ev.timestamp}-${ev.type}`,
      text:
        ev.type === 'travel'
          ? `${ev.displayName} viajó de ${ev.from} → ${ev.to}`
          : `[${ev.type}] ${ev.displayName || ''}`,
      timestamp: ev.timestamp,
    })),
    ...messages.map((m) => ({
      kind: 'chat' as const,
      id: m.id,
      displayName: m.displayName,
      text: m.message,
      channel: m.channel || 'zone',
      timestamp: m.timestamp,
    })),
  ].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return (
    <div className="card flex flex-col h-[420px]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Chat en vivo</h2>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-emerald-400' : 'bg-red-500'
            }`}
          />
          <span className="text-zinc-500">
            {connected ? 'Online' : 'Desconectado'}
            {onlineTotal > 0 && ` · ${onlineTotal} conectados`}
          </span>
        </div>
      </div>

      {/* Presence in zone */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {zonePlayers.length === 0 ? (
          <span className="text-zinc-600 text-xs">Nadie más en esta zona</span>
        ) : (
          zonePlayers.map((p) => (
            <span
              key={p.playerId}
              className="text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-700"
            >
              {p.displayName}
            </span>
          ))
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-1.5 mb-3 pr-1 text-sm">
        {feed.length === 0 && (
          <p className="text-zinc-600 text-xs">
            El chat de zona y los eventos del mundo aparecerán aquí.
          </p>
        )}
        {feed.map((item) =>
          item.kind === 'event' ? (
            <p key={item.id} className="text-zinc-500 text-xs italic">
              {item.text}
            </p>
          ) : (
            <p key={item.id}>
              <span className="text-zinc-600 text-[10px] mr-1">
                {item.channel === 'global' ? '[global]' : '[zona]'}
              </span>
              <span className="text-amber-400 font-medium">
                {item.displayName}
              </span>
              <span className="text-zinc-400">: </span>
              <span className="text-zinc-200">{item.text}</span>
            </p>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="flex gap-2">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as 'zone' | 'global')}
          className="bg-zinc-900 border border-zinc-700 rounded-lg text-xs px-2 text-zinc-300"
        >
          <option value="zone">Zona</option>
          <option value="global">Global</option>
        </select>
        <input
          className="input flex-1 py-2 text-sm"
          placeholder={connected ? 'Escribe un mensaje...' : 'Conectando...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!connected}
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!connected || !text.trim()}
          className="btn-primary text-sm px-4"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
