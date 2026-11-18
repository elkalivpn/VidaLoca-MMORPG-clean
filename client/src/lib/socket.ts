'use client';

import { io, Socket } from 'socket.io-client';

const RAW_WS_URL = (
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ''
)
  .trim()
  .replace(/\/+$/, '');
const WS_URL = RAW_WS_URL.endsWith('/api')
  ? RAW_WS_URL.slice(0, -4)
  : RAW_WS_URL;

let socket: Socket | null = null;
let socketToken = '';

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket && socketToken === token && (socket.connected || socket.active)) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socketToken = token;
  socket = io(`${WS_URL}/game`, {
    auth: { token },
    transports: ['websocket', 'polling'],
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
    socketToken = '';
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

export type PlayerAnimState = 'idle' | 'walk' | 'run' | 'drive';

export interface SpatialPlayer {
  playerId: string;
  displayName: string;
  locationId?: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  rotationY?: number;
  anim?: PlayerAnimState;
  vehicleId?: string;
  vehicleClass?: string;
  isDrifting?: boolean;
  speed?: number;
  isMoving?: boolean;
  lifestyle?: string;
  hp?: number;
  updatedAt?: number;
}

export interface PlayerMovePayload {
  x: number;
  y: number;
  z: number;
  rotY: number;
  anim?: PlayerAnimState;
  vehicleId?: string;
  vehicleClass?: string;
  isDrifting?: boolean;
}

export interface CombatShotPayload {
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirZ: number;
  weaponType?: string;
}

export interface RemoteCombatShot extends CombatShotPayload {
  playerId: string;
  displayName: string;
  timestamp: string;
}

export interface CombatPvpHitPayload {
  targetPlayerId: string;
  attackType: 'SHOT' | 'MELEE';
  weaponType?: string;
}

export interface CombatDamagedEvent {
  attackerId: string;
  attackerName: string;
  targetPlayerId: string;
  targetName: string;
  attackType: 'SHOT' | 'MELEE';
  damage: number;
  remainingHp: number;
  knockout: boolean;
  lootEuros?: number;
  narrative?: string;
  x?: number;
  z?: number;
  timestamp: string;
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

export function emitCombatShot(payload: CombatShotPayload) {
  if (!socket?.connected) return;
  socket.emit('combat:fire', payload);
}

export function emitCombatPvpHit(payload: CombatPvpHitPayload) {
  if (!socket?.connected) return;
  socket.emit('combat:pvp-hit', payload);
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
