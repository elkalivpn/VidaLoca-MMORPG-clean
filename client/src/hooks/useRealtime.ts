'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  type ChatMessage,
  type PresencePlayer,
  type WorldEvent,
} from '@/lib/socket';

export function useRealtime(enabled: boolean) {
  const [connected, setConnected] = useState(false);
  const [zonePlayers, setZonePlayers] = useState<PresencePlayer[]>([]);
  const [onlineTotal, setOnlineTotal] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [worldEvents, setWorldEvents] = useState<WorldEvent[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const handlersBound = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = connectSocket(token);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onConnected = (data: {
      locationId: string;
      displayName: string;
    }) => {
      setLocationId(data.locationId);
      setConnected(true);
    };

    const onPresenceZone = (data: {
      locationId: string;
      players: PresencePlayer[];
    }) => {
      setLocationId(data.locationId);
      setZonePlayers(data.players || []);
    };

    const onPlayerJoined = (p: PresencePlayer) => {
      setZonePlayers((prev) => {
        if (prev.some((x) => x.playerId === p.playerId)) return prev;
        return [...prev, p];
      });
    };

    const onPlayerLeft = (p: { playerId: string }) => {
      setZonePlayers((prev) => prev.filter((x) => x.playerId !== p.playerId));
    };

    const onChat = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), msg]);
    };

    const onWorldEvent = (ev: WorldEvent) => {
      setWorldEvents((prev) => [...prev.slice(-29), ev]);
    };

    const onError = (err: { message?: string }) => {
      console.warn('[WS]', err?.message);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connected', onConnected);
    socket.on('presence:zone', onPresenceZone);
    socket.on('player:joined', onPlayerJoined);
    socket.on('player:left', onPlayerLeft);
    socket.on('chat:message', onChat);
    socket.on('world:event', onWorldEvent);
    socket.on('error', onError);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connected', onConnected);
      socket.off('presence:zone', onPresenceZone);
      socket.off('player:joined', onPlayerJoined);
      socket.off('player:left', onPlayerLeft);
      socket.off('chat:message', onChat);
      socket.off('world:event', onWorldEvent);
      socket.off('error', onError);
      // Don't fully disconnect on unmount of one component — logout handles it
    };
  }, [enabled]);

  const joinZone = useCallback((nextLocationId: string) => {
    const socket = getSocket();
    if (!socket?.connected) return Promise.resolve(null);
    return new Promise<any>((resolve) => {
      socket.emit('zone:join', { locationId: nextLocationId }, (res: any) => {
        if (res?.players) setZonePlayers(res.players);
        if (res?.locationId) setLocationId(res.locationId);
        resolve(res);
      });
    });
  }, []);

  const sendZoneChat = useCallback((message: string) => {
    const socket = getSocket();
    if (!socket?.connected) return;
    socket.emit('chat:zone', { message });
  }, []);

  const sendGlobalChat = useCallback((message: string) => {
    const socket = getSocket();
    if (!socket?.connected) return;
    socket.emit('chat:global', { message });
  }, []);

  const requestPresence = useCallback(() => {
    const socket = getSocket();
    if (!socket?.connected) return;
    socket.emit('presence:request', {}, (res: any) => {
      if (res?.players) setZonePlayers(res.players);
      if (typeof res?.onlineTotal === 'number') setOnlineTotal(res.onlineTotal);
    });
  }, []);

  return {
    connected,
    zonePlayers,
    onlineTotal,
    messages,
    worldEvents,
    locationId,
    joinZone,
    sendZoneChat,
    sendGlobalChat,
    requestPresence,
    disconnect: disconnectSocket,
  };
}
