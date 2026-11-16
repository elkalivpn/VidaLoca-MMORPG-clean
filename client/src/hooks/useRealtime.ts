'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  connectSocket,
  disconnectSocket,
  emitPlayerMove,
  getSocket,
  type ChatMessage,
  type PlayerMovePayload,
  type PresencePlayer,
  type PursuitAlert,
  type SpatialPlayer,
  type WorldEvent,
  type WorldSnapshotPayload,
} from '@/lib/socket';

export function useRealtime(enabled: boolean) {
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [zonePlayers, setZonePlayers] = useState<PresencePlayer[]>([]);
  const [onlineTotal, setOnlineTotal] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [worldEvents, setWorldEvents] = useState<WorldEvent[]>([]);
  const [pursuitAlerts, setPursuitAlerts] = useState<PursuitAlert[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const remotePlayersRef = useRef<Map<string, SpatialPlayer>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = connectSocket(token);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onConnected = (data: {
      playerId?: string;
      locationId: string;
      displayName: string;
    }) => {
      if (data.playerId) setPlayerId(data.playerId);
      setLocationId(data.locationId);
      setConnected(true);
    };

    const onPresenceZone = (data: {
      locationId: string;
      players: PresencePlayer[];
    }) => {
      setLocationId(data.locationId);
      setZonePlayers(data.players || []);
      for (const [id, entry] of remotePlayersRef.current.entries()) {
        if (entry.locationId && entry.locationId !== data.locationId) {
          remotePlayersRef.current.delete(id);
        }
      }
    };

    const onPlayerJoined = (p: PresencePlayer) => {
      setZonePlayers((prev) => {
        if (prev.some((x) => x.playerId === p.playerId)) return prev;
        return [...prev, p];
      });
    };

    const onPlayerLeft = (p: { playerId: string }) => {
      setZonePlayers((prev) => prev.filter((x) => x.playerId !== p.playerId));
      remotePlayersRef.current.delete(p.playerId);
    };

    const onWorldSnapshot = (
      payload: WorldSnapshotPayload | SpatialPlayer[],
    ) => {
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.players)
          ? payload.players
          : [];
      const now = Date.now();
      const activeIds = new Set<string>();
      for (const p of list) {
        if (!p?.playerId) continue;
        activeIds.add(p.playerId);
        remotePlayersRef.current.set(p.playerId, {
          ...p,
          updatedAt: now,
        });
      }
      for (const id of remotePlayersRef.current.keys()) {
        if (!activeIds.has(id)) {
          remotePlayersRef.current.delete(id);
        }
      }
    };

    const onChat = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), msg]);
    };

    const onWorldEvent = (ev: WorldEvent) => {
      setWorldEvents((prev) => [...prev.slice(-29), ev]);
    };

    const onPursuitAlert = (payload: Partial<PursuitAlert>) => {
      const alert: PursuitAlert = {
        ...payload,
        id:
          payload.id ||
          `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'alert',
        timestamp: payload.timestamp || new Date().toISOString(),
      };
      setPursuitAlerts((prev) => [...prev.slice(-19), alert]);
    };

    const onPursuitResolved = (payload: Partial<PursuitAlert>) => {
      const alert: PursuitAlert = {
        ...payload,
        id:
          payload.id ||
          `resolved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'resolved',
        timestamp: payload.timestamp || new Date().toISOString(),
      };
      setPursuitAlerts((prev) => [...prev.slice(-19), alert]);
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
    socket.on('world:snapshot', onWorldSnapshot);
    socket.on('chat:message', onChat);
    socket.on('world:event', onWorldEvent);
    socket.on('pursuit:alert', onPursuitAlert);
    socket.on('pursuit:resolved', onPursuitResolved);
    socket.on('error', onError);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connected', onConnected);
      socket.off('presence:zone', onPresenceZone);
      socket.off('player:joined', onPlayerJoined);
      socket.off('player:left', onPlayerLeft);
      socket.off('world:snapshot', onWorldSnapshot);
      socket.off('chat:message', onChat);
      socket.off('world:event', onWorldEvent);
      socket.off('pursuit:alert', onPursuitAlert);
      socket.off('pursuit:resolved', onPursuitResolved);
      socket.off('error', onError);
      // Don't fully disconnect on unmount of one component — logout handles it
    };
  }, [enabled]);

  const joinZone = useCallback((nextLocationId: string) => {
    const socket = getSocket();
    if (!socket?.connected) return Promise.resolve(null);
    return new Promise<{
      players?: PresencePlayer[];
      locationId?: string;
    } | null>((resolve) => {
      socket.emit(
        'zone:join',
        { locationId: nextLocationId },
        (res: { players?: PresencePlayer[]; locationId?: string } | null) => {
          if (res?.players) setZonePlayers(res.players);
          if (res?.locationId) setLocationId(res.locationId);
          resolve(res);
        },
      );
    });
  }, []);

  const sendZoneChat = useCallback((message: string) => {
    const socket = getSocket();
    if (!socket?.connected) {
      return Promise.resolve({
        ok: false,
        error: 'Sin conexión en tiempo real al servidor',
      });
    }
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      socket.emit(
        'chat:zone',
        { message },
        (res?: { ok?: boolean; error?: string; message?: string }) => {
          if (res && res.ok === false) {
            resolve({
              ok: false,
              error: res.error || 'No se pudo enviar el mensaje',
            });
          } else {
            resolve({ ok: true });
          }
        },
      );
    });
  }, []);

  const sendGlobalChat = useCallback((message: string) => {
    const socket = getSocket();
    if (!socket?.connected) {
      return Promise.resolve({
        ok: false,
        error: 'Sin conexión en tiempo real al servidor',
      });
    }
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      socket.emit(
        'chat:global',
        { message },
        (res?: { ok?: boolean; error?: string; message?: string }) => {
          if (res && res.ok === false) {
            resolve({
              ok: false,
              error: res.error || 'No se pudo enviar el mensaje',
            });
          } else {
            resolve({ ok: true });
          }
        },
      );
    });
  }, []);

  const requestPresence = useCallback(() => {
    const socket = getSocket();
    if (!socket?.connected) return;
    socket.emit(
      'presence:request',
      {},
      (res: { players?: PresencePlayer[]; onlineTotal?: number } | null) => {
        if (res?.players) setZonePlayers(res.players);
        if (typeof res?.onlineTotal === 'number')
          setOnlineTotal(res.onlineTotal);
      },
    );
  }, []);

  const emitMove = useCallback((payload: PlayerMovePayload) => {
    emitPlayerMove(payload);
  }, []);

  return {
    connected,
    playerId,
    zonePlayers,
    onlineTotal,
    messages,
    worldEvents,
    pursuitAlerts,
    locationId,
    remotePlayersRef,
    joinZone,
    sendZoneChat,
    sendGlobalChat,
    requestPresence,
    emitMove,
    disconnect: disconnectSocket,
  };
}
