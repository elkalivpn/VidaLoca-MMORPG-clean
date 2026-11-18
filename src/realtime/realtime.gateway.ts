import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChatMessageDto,
  CombatFireDto,
  CombatPvpHitDto,
  JoinZoneDto,
  PlayerAnim,
  PlayerMoveDto,
} from './dto/realtime.dto';
import { isValidZoneId, ZONES_BY_ID } from '../common/constants/zones';
import { AntiCheatService } from '../security/anti-cheat.service';
import { AntiPromptInjectionService } from '../security/anti-prompt-injection.service';
import { WorldService } from '../world/world.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  playerId?: string;
  displayName?: string;
  locationId?: string;
}

export interface PresenceEntry {
  userId: string;
  playerId: string;
  displayName: string;
  locationId: string;
  socketId: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  anim: PlayerAnim;
  hp: number;
  vehicleId?: string;
  vehicleClass?: string;
  isDrifting?: boolean;
  lastMoveAt: number;
}

@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
        return;
      }
      const allowed = [
        process.env.FRONTEND_URL || '',
        process.env.ALLOWED_ORIGINS || '',
        'https://vidaloca-mmorpg.vercel.app',
        'http://localhost:3001',
      ]
        .join(',')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (
        !origin ||
        allowed.includes(origin) ||
        /^https:\/\/vidaloca[a-z0-9-]*\.vercel\.app$/.test(origin) ||
        /^https:\/\/([a-z0-9-]+\.)?nexusaiholding\.com$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(
          new Error('Origin not allowed by WebSocket CORS policy'),
          false,
        );
      }
    },
    credentials: true,
  },
  namespace: '/game',
})
export class RealtimeGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly MOVE_RATE_LIMIT_MS = 40;
  private readonly CHAT_RATE_LIMIT_MS = 500;
  private readonly COMBAT_FIRE_RATE_LIMIT_MS = 180;
  private readonly COMBAT_PVP_RATE_LIMIT_MS = 350;
  private readonly MAX_SPEED_UNITS_PER_SEC = 60;
  private readonly TICK_INTERVAL_MS = 100;

  /** socketId → presence */
  private presence = new Map<string, PresenceEntry>();
  /** socketId → last chat timestamp (ms) */
  private lastChatAt = new Map<string, number>();
  /** socketId → last combat:fire timestamp (ms) */
  private lastCombatFireAt = new Map<string, number>();
  /** socketId → last combat:pvp-hit timestamp (ms) */
  private lastCombatPvpAt = new Map<string, number>();
  /** Zonas con movimiento pendiente de emitir en el siguiente tick */
  private dirtyZones = new Set<string>();
  private worldEventTimer?: ReturnType<typeof setInterval>;
  private worldEventInitialTimer?: ReturnType<typeof setTimeout>;
  private tickTimer?: ReturnType<typeof setInterval>;

  private readonly WORLD_EVENTS = [
    {
      type: 'raid',
      title: 'Redada en Malasaña',
      message:
        'La policía peina Malasaña. Evita la zona o prepárate para correr.',
      zone: 'malasana',
      severity: 'high',
    },
    {
      type: 'deal',
      title: 'Negocio en Puerto Banús',
      message:
        'Un contacto ofrece un trato opaco en los yates. Solo para los que se atreven.',
      zone: 'puerto_banus',
      severity: 'medium',
    },
    {
      type: 'festival',
      title: 'Noche en las Ramblas',
      message: 'El turismo desborda Barcelona. Más objetivos… y más testigos.',
      zone: 'barcelona_ramblas',
      severity: 'low',
    },
    {
      type: 'power',
      title: 'Apagón en el Casco Antiguo',
      message:
        'Sevilla a oscuras. Ideal para moverse sin cámaras… si no te pierdes.',
      zone: 'sevilla_casco',
      severity: 'medium',
    },
    {
      type: 'heist',
      title: 'Alarma en Salamanca',
      message:
        'Algo grande se mueve en los áticos de Salamanca. Los clanes ya están al tanto.',
      zone: 'salamanca',
      severity: 'high',
    },
    {
      type: 'market',
      title: 'Boom del mercado gris',
      message:
        'Los precios de vehículos de lujo fluctúan. Quien compre ahora, gana o quema dinero.',
      zone: null,
      severity: 'low',
    },
  ];

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    @Optional() private readonly antiCheat?: AntiCheatService,
    @Optional()
    private readonly antiPromptInjection?: AntiPromptInjectionService,
    @Optional() private readonly worldService?: WorldService,
  ) {}

  // ─── Connection lifecycle ────────────────────────────────────────────

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const authPayload = client.handshake.auth as
        { token?: unknown } | undefined;
      const authHeader = client.handshake.headers?.authorization;
      const token =
        (typeof authPayload?.token === 'string'
          ? authPayload.token
          : undefined) ||
        (typeof authHeader === 'string'
          ? authHeader.replace('Bearer ', '')
          : undefined);

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const payload = this.jwtService.verify<{
        sub: string;
        tokenType?: string;
        tv?: number;
      }>(token, { secret });
      if (payload?.tokenType && payload.tokenType !== 'access') {
        client.emit('error', { message: 'Invalid token type' });
        client.disconnect(true);
        return;
      }
      const userId = payload.sub;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { player: true },
      });

      if (!user || user.isBanned) {
        client.emit('error', { message: 'Account banned or not found' });
        client.disconnect(true);
        return;
      }

      if (
        typeof payload.tv === 'number' &&
        typeof user.tokenVersion === 'number' &&
        payload.tv !== user.tokenVersion
      ) {
        client.emit('error', { message: 'Session revoked' });
        client.disconnect(true);
        return;
      }

      if (!user.player) {
        client.emit('error', { message: 'Player not found' });
        client.disconnect(true);
        return;
      }

      client.userId = userId;
      client.playerId = user.player.id;
      client.displayName = user.player.displayName;
      client.locationId = user.player.locationId || 'madrid_centro';

      // Mark online in DB
      await this.prisma.player.update({
        where: { id: user.player.id },
        data: { isOnline: true, lastLogin: new Date() },
      });

      // Join personal room + zone room
      void client.join(`user:${userId}`);
      void client.join(`zone:${client.locationId}`);

      this.presence.set(client.id, {
        userId,
        playerId: user.player.id,
        displayName: user.player.displayName,
        locationId: client.locationId,
        socketId: client.id,
        x: 0,
        y: 0,
        z: 0,
        rotY: 0,
        anim: 'idle',
        hp: 100,
        vehicleId: undefined,
        lastMoveAt: 0,
      });
      this.dirtyZones.add(client.locationId);

      // Notify zone of arrival
      client.to(`zone:${client.locationId}`).emit('player:joined', {
        playerId: user.player.id,
        displayName: user.player.displayName,
        locationId: client.locationId,
      });

      // Send current zone presence to the new client
      const zonePlayers = this.getZonePresence(client.locationId);
      client.emit('presence:zone', {
        locationId: client.locationId,
        players: zonePlayers,
      });

      client.emit('world:snapshot', {
        locationId: client.locationId,
        timestamp: Date.now(),
        players: this.getZoneSnapshotPlayers(client.locationId),
      });

      client.emit('connected', {
        playerId: user.player.id,
        displayName: user.player.displayName,
        locationId: client.locationId,
      });

      this.logger.log(
        `${user.player.displayName} connected → zone ${client.locationId}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Auth failed for ${client.id}: ${msg}`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.lastChatAt.delete(client.id);
    this.lastCombatFireAt.delete(client.id);
    this.lastCombatPvpAt.delete(client.id);
    const entry = this.presence.get(client.id);
    if (!entry) return;

    this.presence.delete(client.id);

    // Only mark offline if no other sockets for this user
    const stillOnline = [...this.presence.values()].some(
      (p) => p.userId === entry.userId,
    );

    if (!stillOnline) {
      await this.prisma.player
        .update({
          where: { id: entry.playerId },
          data: { isOnline: false },
        })
        .catch(() => undefined);
    }

    client.to(`zone:${entry.locationId}`).emit('player:left', {
      playerId: entry.playerId,
      displayName: entry.displayName,
      locationId: entry.locationId,
    });

    this.logger.log(`${entry.displayName} disconnected`);
  }

  // ─── Zone travel ─────────────────────────────────────────────────────

  @SubscribeMessage('zone:join')
  async handleJoinZone(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: JoinZoneDto,
  ) {
    if (!client.userId || !client.playerId)
      return { error: 'Not authenticated' };

    const nextZone = body?.locationId;
    if (!nextZone || !isValidZoneId(nextZone)) {
      return { error: 'Invalid locationId' };
    }

    const prevZone = client.locationId;
    if (prevZone === nextZone) {
      return { ok: true, locationId: nextZone };
    }

    const dbPlayer = this.prisma.player.findUnique
      ? await this.prisma.player.findUnique({
          where: { id: client.playerId },
          select: { locationId: true, jailUntil: true },
        })
      : null;

    if (
      dbPlayer?.jailUntil &&
      new Date(dbPlayer.jailUntil).getTime() > Date.now()
    ) {
      return { error: 'No puedes viajar mientras estás en el calabozo' };
    }

    const authoritativeZone =
      dbPlayer?.locationId || prevZone || 'madrid_centro';
    const prevCity = ZONES_BY_ID[authoritativeZone]?.city;
    const nextCity = ZONES_BY_ID[nextZone]?.city;
    const sameCityMove = Boolean(prevCity && nextCity && prevCity === nextCity);

    // Block free cross-city teleportation over WebSocket unless DB locationId already moved via /world/travel
    if (
      dbPlayer?.locationId &&
      dbPlayer.locationId !== nextZone &&
      !sameCityMove
    ) {
      void this.antiCheat?.recordViolation({
        userId: client.userId,
        playerId: client.playerId,
        rule: 'TELEPORT',
        severity: 'HIGH',
        evidence: {
          channel: 'zone:join',
          from: dbPlayer.locationId,
          attemptedTo: nextZone,
        },
      });
      return { error: 'Intercity travel requires /world/travel' };
    }

    // Leave old zone room
    if (prevZone) {
      void client.leave(`zone:${prevZone}`);
      client.to(`zone:${prevZone}`).emit('player:left', {
        playerId: client.playerId,
        displayName: client.displayName,
        locationId: prevZone,
      });
    }

    // Join new zone
    void client.join(`zone:${nextZone}`);
    client.locationId = nextZone;

    const entry = this.presence.get(client.id);
    if (entry) {
      entry.locationId = nextZone;
      entry.x = 0;
      entry.y = 0;
      entry.z = 0;
      entry.rotY = 0;
      entry.anim = 'idle';
      entry.vehicleId = undefined;
      entry.vehicleClass = undefined;
      entry.isDrifting = undefined;
      entry.lastMoveAt = 0;
    }
    this.dirtyZones.add(nextZone);

    // Persist location only for same-city district switches (intercity already persisted via /world/travel)
    if (!dbPlayer || dbPlayer.locationId !== nextZone) {
      await this.prisma.player.update({
        where: { id: client.playerId },
        data: { locationId: nextZone },
      });
    }

    client.to(`zone:${nextZone}`).emit('player:joined', {
      playerId: client.playerId,
      displayName: client.displayName,
      locationId: nextZone,
    });

    const zonePlayers = this.getZonePresence(nextZone);
    client.emit('presence:zone', {
      locationId: nextZone,
      players: zonePlayers,
    });

    client.emit('world:snapshot', {
      locationId: nextZone,
      timestamp: Date.now(),
      players: this.getZoneSnapshotPlayers(nextZone),
    });

    // Broadcast world event
    this.server.emit('world:event', {
      type: 'travel',
      displayName: client.displayName,
      from: prevZone,
      to: nextZone,
      timestamp: new Date().toISOString(),
    });

    return { ok: true, locationId: nextZone, players: zonePlayers };
  }

  // ─── Chat ────────────────────────────────────────────────────────────

  @SubscribeMessage('chat:zone')
  async handleZoneChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: ChatMessageDto,
  ) {
    if (!client.userId || !client.displayName) {
      return { error: 'Not authenticated' };
    }

    let message = (body?.message || '').trim().slice(0, 500);
    if (!message) return { error: 'Empty message' };

    if (this.antiPromptInjection) {
      const inspection = this.antiPromptInjection.inspectInput(message, 500);
      if (!inspection.safe) {
        const res = await this.antiCheat?.recordViolation({
          userId: client.userId,
          playerId: client.playerId,
          rule: 'PROMPT_INJECT',
          severity: 'HIGH',
          evidence: { channel: 'chat:zone', rules: inspection.matchedRules },
        });
        if (res?.shouldDisconnect) {
          client.disconnect(true);
        }
        return {
          ok: false,
          error: 'Mensaje bloqueado por el escudo anti-inyección',
          reason: 'security_blocked',
        };
      }
      message = inspection.sanitized;
      if (!message) return { error: 'Empty message' };
    }

    if (this.isChatRateLimited(client.id)) {
      return {
        ok: false,
        error: 'Rate limit exceeded',
        reason: 'rate_limited',
      };
    }

    const locationId = client.locationId || 'madrid_centro';
    const payload = {
      id: `${Date.now()}-${client.id.slice(0, 6)}`,
      playerId: client.playerId,
      displayName: client.displayName,
      message,
      locationId,
      timestamp: new Date().toISOString(),
    };

    this.server.to(`zone:${locationId}`).emit('chat:message', payload);
    return { ok: true, ...payload };
  }

  @SubscribeMessage('chat:global')
  async handleGlobalChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: ChatMessageDto,
  ) {
    if (!client.userId || !client.displayName) {
      return { error: 'Not authenticated' };
    }

    let message = (body?.message || '').trim().slice(0, 500);
    if (!message) return { error: 'Empty message' };

    if (this.antiPromptInjection) {
      const inspection = this.antiPromptInjection.inspectInput(message, 500);
      if (!inspection.safe) {
        const res = await this.antiCheat?.recordViolation({
          userId: client.userId,
          playerId: client.playerId,
          rule: 'PROMPT_INJECT',
          severity: 'HIGH',
          evidence: { channel: 'chat:global', rules: inspection.matchedRules },
        });
        if (res?.shouldDisconnect) {
          client.disconnect(true);
        }
        return {
          ok: false,
          error: 'Mensaje bloqueado por el escudo anti-inyección',
          reason: 'security_blocked',
        };
      }
      message = inspection.sanitized;
      if (!message) return { error: 'Empty message' };
    }

    if (this.isChatRateLimited(client.id)) {
      return {
        ok: false,
        error: 'Rate limit exceeded',
        reason: 'rate_limited',
      };
    }

    const payload = {
      id: `${Date.now()}-${client.id.slice(0, 6)}`,
      playerId: client.playerId,
      displayName: client.displayName,
      message,
      channel: 'global',
      timestamp: new Date().toISOString(),
    };

    this.server.emit('chat:message', payload);
    return { ok: true, ...payload };
  }

  private isChatRateLimited(socketId: string, now = Date.now()): boolean {
    const last = this.lastChatAt.get(socketId) ?? 0;
    if (last > 0 && now - last < this.CHAT_RATE_LIMIT_MS) {
      return true;
    }
    this.lastChatAt.set(socketId, now);
    return false;
  }

  // ─── Presence query ──────────────────────────────────────────────────

  @SubscribeMessage('presence:request')
  handlePresenceRequest(@ConnectedSocket() client: AuthenticatedSocket) {
    const locationId = client.locationId || 'madrid_centro';
    return {
      locationId,
      players: this.getZonePresence(locationId),
      onlineTotal: this.presence.size,
    };
  }

  // ─── Spatial movement (Fase 2) ────────────────────────────────────────

  @SubscribeMessage('player:move')
  handlePlayerMove(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: PlayerMoveDto,
  ) {
    if (!client.userId || !client.playerId) {
      return { ok: false, error: 'Not authenticated' };
    }

    const entry = this.presence.get(client.id);
    if (!entry) {
      return { ok: false, error: 'Presence not found' };
    }

    if (
      !body ||
      !Number.isFinite(body.x) ||
      !Number.isFinite(body.y) ||
      !Number.isFinite(body.z) ||
      !Number.isFinite(body.rotY)
    ) {
      return { ok: false, error: 'Invalid coordinates' };
    }

    if (
      this.antiCheat &&
      !this.antiCheat.isWithinWorldBounds(body.x, body.y, body.z)
    ) {
      void this.antiCheat
        .recordViolation({
          userId: client.userId,
          playerId: client.playerId,
          rule: 'OUT_OF_BOUNDS',
          evidence: { x: body.x, y: body.y, z: body.z },
        })
        .then(({ shouldDisconnect }) => {
          if (shouldDisconnect) client.disconnect(true);
        });
      return { ok: false, reason: 'out_of_bounds' };
    }

    const now = Date.now();

    // Rate-limit por socket (< 40ms desde el último move)
    if (
      entry.lastMoveAt > 0 &&
      now - entry.lastMoveAt < this.MOVE_RATE_LIMIT_MS
    ) {
      return { ok: false, reason: 'rate_limited' };
    }

    // Anti-cheat server-authoritative: velocidad máxima 60 unidades/seg
    const dtSeconds =
      entry.lastMoveAt > 0 ? Math.min((now - entry.lastMoveAt) / 1000, 1) : 1;
    const distance = Math.hypot(
      body.x - entry.x,
      body.y - entry.y,
      body.z - entry.z,
    );
    const maxAllowedDistance = this.MAX_SPEED_UNITS_PER_SEC * dtSeconds;

    if (distance > maxAllowedDistance) {
      this.logger.warn(
        `Rejected move for ${entry.displayName}: distance=${distance.toFixed(2)} > max=${maxAllowedDistance.toFixed(2)}`,
      );
      void this.antiCheat
        ?.recordViolation({
          userId: client.userId,
          playerId: client.playerId,
          rule: distance > maxAllowedDistance * 4 ? 'TELEPORT' : 'SPEEDHACK',
          evidence: { distance, maxAllowedDistance },
        })
        .then(({ shouldDisconnect }) => {
          if (shouldDisconnect) client.disconnect(true);
        });
      return { ok: false, reason: 'speed_limit_exceeded' };
    }

    entry.x = body.x;
    entry.y = body.y;
    entry.z = body.z;
    entry.rotY = body.rotY;
    entry.anim = body.anim ?? 'idle';
    entry.vehicleId = body.vehicleId;
    entry.vehicleClass = body.vehicleClass;
    entry.isDrifting = body.isDrifting;
    entry.lastMoveAt = now;

    this.dirtyZones.add(entry.locationId);

    return { ok: true };
  }

  // ─── Combat sync ─────────────────────────────────────────────────────

  @SubscribeMessage('combat:fire')
  handleCombatFire(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: CombatFireDto,
  ) {
    if (!client.userId || !client.playerId) {
      return { ok: false, error: 'Not authenticated' };
    }

    const entry = this.presence.get(client.id);
    if (!entry) {
      return { ok: false, error: 'Presence not found' };
    }

    if (
      !body ||
      !Number.isFinite(body.x) ||
      !Number.isFinite(body.y) ||
      !Number.isFinite(body.z) ||
      !Number.isFinite(body.dirX) ||
      !Number.isFinite(body.dirZ)
    ) {
      return { ok: false, error: 'Invalid coordinates' };
    }

    const now = Date.now();
    const lastFire = this.lastCombatFireAt.get(client.id) ?? 0;
    if (lastFire > 0 && now - lastFire < this.COMBAT_FIRE_RATE_LIMIT_MS) {
      return { ok: false, reason: 'rate_limited' };
    }
    this.lastCombatFireAt.set(client.id, now);

    const payload = {
      playerId: client.playerId,
      displayName: client.displayName,
      x: body.x,
      y: body.y,
      z: body.z,
      dirX: body.dirX,
      dirZ: body.dirZ,
      weaponType: body.weaponType || 'PISTOL',
      timestamp: new Date().toISOString(),
    };

    this.server
      .to(`zone:${client.locationId || 'madrid_centro'}`)
      .emit('combat:shot', payload);

    return { ok: true, ...payload };
  }

  @SubscribeMessage('combat:pvp-hit')
  async handleCombatPvpHit(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: CombatPvpHitDto,
  ) {
    if (!client.userId || !client.playerId) {
      return { ok: false, error: 'Not authenticated' };
    }

    const entry = this.presence.get(client.id);
    if (!entry) {
      return { ok: false, error: 'Presence not found' };
    }

    if (
      !body ||
      typeof body.targetPlayerId !== 'string' ||
      !body.targetPlayerId.trim() ||
      (body.attackType !== 'SHOT' && body.attackType !== 'MELEE')
    ) {
      return { ok: false, error: 'Invalid PvP hit payload' };
    }

    if (body.targetPlayerId === client.playerId) {
      return { ok: false, error: 'Cannot target yourself' };
    }

    const targetEntry = [...this.presence.values()].find(
      (p) => p.playerId === body.targetPlayerId,
    );
    if (!targetEntry) {
      return { ok: false, error: 'Target player not found' };
    }

    if (targetEntry.locationId !== entry.locationId) {
      return { ok: false, error: 'Target player is in a different zone' };
    }

    const hasAttackerCoords =
      Number.isFinite(entry.x) && Number.isFinite(entry.z);
    const hasTargetCoords =
      Number.isFinite(targetEntry.x) && Number.isFinite(targetEntry.z);
    if (hasAttackerCoords && hasTargetCoords) {
      const dy =
        Number.isFinite(entry.y) && Number.isFinite(targetEntry.y)
          ? targetEntry.y - entry.y
          : 0;
      const distance = Math.hypot(
        targetEntry.x - entry.x,
        dy,
        targetEntry.z - entry.z,
      );
      const maxRange = body.attackType === 'MELEE' ? 6.5 : 65;
      if (distance > maxRange) {
        return { ok: false, reason: 'out_of_range' };
      }
    }

    const now = Date.now();
    const lastPvp = this.lastCombatPvpAt.get(client.id) ?? 0;
    if (lastPvp > 0 && now - lastPvp < this.COMBAT_PVP_RATE_LIMIT_MS) {
      return { ok: false, reason: 'rate_limited' };
    }
    this.lastCombatPvpAt.set(client.id, now);

    const damage =
      body.attackType === 'MELEE'
        ? 18 + Math.floor(Math.random() * 11)
        : 24 + Math.floor(Math.random() * 13);

    const currentHp = Number.isFinite(targetEntry.hp) ? targetEntry.hp : 100;
    targetEntry.hp = Math.max(0, currentHp - damage);

    let knockout = false;
    let lootEuros = 0;
    let attackerStats: Record<string, unknown> | undefined;

    if (targetEntry.hp <= 0) {
      knockout = true;
      targetEntry.hp = 100;
      if (this.worldService) {
        try {
          const koRes = await this.worldService.resolvePvpKnockout(
            entry.userId,
            targetEntry.userId,
          );
          lootEuros = koRes?.lootEuros ?? 0;
          attackerStats = koRes?.attackerStats;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Error resolving PvP knockout (${entry.userId} -> ${targetEntry.userId}): ${msg}`,
          );
        }
      }
    }

    this.dirtyZones.add(entry.locationId);

    const timestamp = new Date().toISOString();
    const narrative = knockout
      ? `${entry.displayName} deja KO a ${targetEntry.displayName}${lootEuros > 0 ? ` y le roba ${lootEuros}€` : ''}.`
      : `${entry.displayName} golpea a ${targetEntry.displayName} (${body.attackType === 'MELEE' ? 'cuerpo a cuerpo' : body.weaponType || 'PISTOL'}) por ${damage} de daño.`;

    const damagePayload = {
      attackerId: entry.playerId,
      attackerName: entry.displayName,
      targetPlayerId: targetEntry.playerId,
      targetName: targetEntry.displayName,
      attackType: body.attackType,
      damage,
      remainingHp: targetEntry.hp,
      knockout,
      lootEuros,
      narrative,
      x: targetEntry.x,
      z: targetEntry.z,
      timestamp,
    };

    this.server
      .to(`zone:${entry.locationId}`)
      .emit('combat:damaged', damagePayload);

    if (knockout) {
      this.server.to(`zone:${entry.locationId}`).emit('world:event', {
        type: 'pvp_ko',
        title: 'KO en la calle',
        message: narrative,
        zone: entry.locationId,
        attackerId: entry.playerId,
        attackerName: entry.displayName,
        targetPlayerId: targetEntry.playerId,
        targetName: targetEntry.displayName,
        lootEuros,
        severity: 'medium',
        timestamp,
      });
    }

    return {
      ok: true,
      ...damagePayload,
      ...(attackerStats ? { attackerStats } : {}),
    };
  }

  // ─── Helpers (callable from other services) ──────────────────────────

  onModuleInit() {
    // Limpia estados isOnline fantasma tras reinicios abruptos en modo single-node
    const hasRedis = Boolean(
      this.configService?.get?.<string>('REDIS_URL')?.trim() ??
      process.env.REDIS_URL?.trim(),
    );
    if (!hasRedis && this.prisma?.player?.updateMany) {
      void Promise.resolve(
        this.prisma.player.updateMany({
          where: { isOnline: true },
          data: { isOnline: false },
        }),
      ).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Could not reset stale isOnline flags on boot: ${msg}`,
        );
      });
    }

    // Eventos dinámicos de mundo cada 3 minutos en producción
    this.worldEventTimer = setInterval(
      () => this.broadcastRandomWorldEvent(),
      3 * 60 * 1000,
    );
    // Primer evento dinámico a los 45s tras el arranque
    this.worldEventInitialTimer = setTimeout(
      () => this.broadcastRandomWorldEvent(),
      45_000,
    );
    // Tick loop autoritativo a 10 Hz (~100ms)
    this.tickTimer = setInterval(
      () => this.flushWorldSnapshots(),
      this.TICK_INTERVAL_MS,
    );
    this.logger.log('World events scheduler and 10 Hz tick loop started');
  }

  async onModuleDestroy() {
    if (this.worldEventTimer) {
      clearInterval(this.worldEventTimer);
      this.worldEventTimer = undefined;
    }
    if (this.worldEventInitialTimer) {
      clearTimeout(this.worldEventInitialTimer);
      this.worldEventInitialTimer = undefined;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }

    const activePlayerIds = Array.from(
      new Set(Array.from(this.presence.values()).map((p) => p.playerId)),
    );
    if (activePlayerIds.length > 0 && this.prisma?.player?.updateMany) {
      await Promise.resolve(
        this.prisma.player.updateMany({
          where: { id: { in: activePlayerIds } },
          data: { isOnline: false },
        }),
      ).catch(() => undefined);
    }
    this.presence.clear();
  }

  flushWorldSnapshots() {
    if (this.dirtyZones.size === 0 || !this.server) return;

    const timestamp = Date.now();
    for (const locationId of this.dirtyZones) {
      const players = this.getZoneSnapshotPlayers(locationId);
      if (players.length === 0) continue;

      this.server.to(`zone:${locationId}`).emit('world:snapshot', {
        locationId,
        timestamp,
        players,
      });
    }
    this.dirtyZones.clear();
  }

  private broadcastRandomWorldEvent() {
    const ev =
      this.WORLD_EVENTS[Math.floor(Math.random() * this.WORLD_EVENTS.length)];
    this.emitWorldEvent({
      type: ev.type,
      title: ev.title,
      message: ev.message,
      zone: ev.zone,
      severity: ev.severity,
    });
    this.logger.log(`World event: ${ev.title}`);
  }

  /** Broadcast a world event to everyone */
  emitWorldEvent(event: { type: string; [key: string]: unknown }) {
    this.server.emit('world:event', {
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  /** Notify a specific user */
  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /** Notify everyone in a zone */
  emitToZone(locationId: string, event: string, data: unknown) {
    this.server.to(`zone:${locationId}`).emit(event, data);
  }

  /** Notify everyone in a zone about pursuit resolution or alerts */
  emitPursuitEvent(
    locationId: string,
    payload: Record<string, unknown>,
    event: 'pursuit:resolved' | 'pursuit:alert' = 'pursuit:resolved',
  ) {
    if (!this.server) return;
    this.server.to(`zone:${locationId}`).emit(event, {
      ...payload,
      locationId,
      timestamp: new Date().toISOString(),
    });
  }

  private getUniqueZoneEntries(locationId: string): PresenceEntry[] {
    const byPlayer = new Map<string, PresenceEntry>();
    for (const p of this.presence.values()) {
      if (p.locationId !== locationId) continue;
      const existing = byPlayer.get(p.playerId);
      if (!existing || p.lastMoveAt >= existing.lastMoveAt) {
        byPlayer.set(p.playerId, p);
      }
    }
    return [...byPlayer.values()];
  }

  private getZonePresence(locationId: string) {
    return this.getUniqueZoneEntries(locationId).map(
      ({ playerId, displayName, locationId: loc }) => ({
        playerId,
        displayName,
        locationId: loc,
      }),
    );
  }

  private getZoneSnapshotPlayers(locationId: string) {
    return this.getUniqueZoneEntries(locationId).map(
      ({
        playerId,
        displayName,
        x,
        y,
        z,
        rotY,
        anim,
        hp,
        vehicleId,
        vehicleClass,
        isDrifting,
      }) => ({
        playerId,
        displayName,
        x,
        y,
        z,
        rotY,
        anim,
        hp,
        vehicleId,
        vehicleClass,
        isDrifting,
      }),
    );
  }
}
