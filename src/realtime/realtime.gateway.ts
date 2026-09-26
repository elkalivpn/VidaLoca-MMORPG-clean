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
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessageDto, JoinZoneDto } from './dto/realtime.dto';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  playerId?: string;
  displayName?: string;
  locationId?: string;
}

interface PresenceEntry {
  userId: string;
  playerId: string;
  displayName: string;
  locationId: string;
  socketId: string;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/game',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  /** socketId → presence */
  private presence = new Map<string, PresenceEntry>();
  private worldEventTimer?: ReturnType<typeof setInterval>;

  private readonly WORLD_EVENTS = [
    {
      type: 'raid',
      title: 'Redada en Malasaña',
      message: 'La policía peina Malasaña. Evita la zona o prepárate para correr.',
      zone: 'madrid_malasana',
      severity: 'high',
    },
    {
      type: 'deal',
      title: 'Negocio en Puerto Banús',
      message: 'Un contacto ofrece un trato opaco en los yates. Solo para los que se atreven.',
      zone: 'marbella_puerto_banus',
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
      message: 'Sevilla a oscuras. Ideal para moverse sin cámaras… si no te pierdes.',
      zone: 'sevilla_casco',
      severity: 'medium',
    },
    {
      type: 'heist',
      title: 'Alarma en Salamanca',
      message: 'Algo grande se mueve en los áticos de Salamanca. Los clanes ya están al tanto.',
      zone: 'madrid_salamanca',
      severity: 'high',
    },
    {
      type: 'market',
      title: 'Boom del mercado gris',
      message: 'Los precios de vehículos de lujo fluctúan. Quien compre ahora, gana o quema dinero.',
      zone: null,
      severity: 'low',
    },
  ];

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  // ─── Connection lifecycle ────────────────────────────────────────────

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const secret =
        this.configService.get<string>('JWT_SECRET') ||
        'default-secret-change-in-production';
      const payload = this.jwtService.verify(token, { secret });
      const userId = payload.sub as string;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { player: true },
      });

      if (!user?.player) {
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
      client.join(`user:${userId}`);
      client.join(`zone:${client.locationId}`);

      this.presence.set(client.id, {
        userId,
        playerId: user.player.id,
        displayName: user.player.displayName,
        locationId: client.locationId,
        socketId: client.id,
      });

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

      client.emit('connected', {
        playerId: user.player.id,
        displayName: user.player.displayName,
        locationId: client.locationId,
      });

      this.logger.log(
        `${user.player.displayName} connected → zone ${client.locationId}`,
      );
    } catch (err: any) {
      this.logger.warn(`Auth failed for ${client.id}: ${err.message}`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
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
    if (!client.userId || !client.playerId) return { error: 'Not authenticated' };

    const prevZone = client.locationId;
    const nextZone = body.locationId;

    if (prevZone === nextZone) {
      return { ok: true, locationId: nextZone };
    }

    // Leave old zone room
    if (prevZone) {
      client.leave(`zone:${prevZone}`);
      client.to(`zone:${prevZone}`).emit('player:left', {
        playerId: client.playerId,
        displayName: client.displayName,
        locationId: prevZone,
      });
    }

    // Join new zone
    client.join(`zone:${nextZone}`);
    client.locationId = nextZone;

    const entry = this.presence.get(client.id);
    if (entry) {
      entry.locationId = nextZone;
    }

    // Persist location
    await this.prisma.player.update({
      where: { id: client.playerId },
      data: { locationId: nextZone },
    });

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

    const message = (body.message || '').trim().slice(0, 500);
    if (!message) return { error: 'Empty message' };

    const locationId = body.locationId || client.locationId || 'madrid_centro';
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

    const message = (body.message || '').trim().slice(0, 500);
    if (!message) return { error: 'Empty message' };

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

  // ─── Helpers (callable from other services) ──────────────────────────


  onModuleInit() {
    // Evento de mundo cada 3 minutos (demo); en prod ajustar
    this.worldEventTimer = setInterval(() => this.broadcastRandomWorldEvent(), 3 * 60 * 1000);
    // Primer evento a los 45s para que se note en pruebas
    setTimeout(() => this.broadcastRandomWorldEvent(), 45_000);
    this.logger.log('World events scheduler started');
  }

  onModuleDestroy() {
    if (this.worldEventTimer) clearInterval(this.worldEventTimer);
  }

  private broadcastRandomWorldEvent() {
    const ev = this.WORLD_EVENTS[Math.floor(Math.random() * this.WORLD_EVENTS.length)];
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
  emitWorldEvent(event: {
    type: string;
    [key: string]: unknown;
  }) {
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

  private getZonePresence(locationId: string) {
    return [...this.presence.values()]
      .filter((p) => p.locationId === locationId)
      .map(({ playerId, displayName, locationId: loc }) => ({
        playerId,
        displayName,
        locationId: loc,
      }));
  }
}
