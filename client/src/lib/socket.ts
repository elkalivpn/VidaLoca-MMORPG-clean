'use client';

import { io, Socket } from 'socket.io-client';

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || '';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io(`${WS_URL}/game`, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export interface ChatMessage {
  id: string;
  playerId?: string;
  displayName: string;
  message: string;
  locationId?: string;
  channel?: string;
  timestamp: string;
}

export interface PresencePlayer {
  playerId: string;
  displayName: string;
  locationId: string;
}

export interface WorldEvent {
  type: string;
  displayName?: string;
  from?: string;
  to?: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface SpatialPlayer {
  playerId: string;
  displayName: string;
  locationId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed?: number;
  isMoving?: boolean;
  lifestyle?: string;
  updatedAt?: number;
}

export interface PlayerMovePayload {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed?: number;
  isMoving?: boolean;
  locationId?: string;
}

export interface WorldSnapshotPayload {
  locationId?: string;
  players: SpatialPlayer[];
  timestamp?: number;
}

export function emitPlayerMove(payload: PlayerMovePayload) {
  if (!socket?.connected) return;
  socket.emit('player:move', payload);
}

export interface PursuitAlert {
  id: string;
  type: 'alert' | 'resolved';
  suspectId?: string;
  suspectName?: string;
  targetPlayerId?: string;
  officerId?: string;
  officerName?: string;
  locationId?: string;
  wantedLevel?: number;
  heat?: number;
  bountyEuros?: number;
  outcome?: string;
  message?: string;
  timestamp: string;
}
