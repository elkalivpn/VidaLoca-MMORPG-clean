import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { PrismaService } from '../prisma/prisma.service';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let prisma: {
    user: { findUnique: jest.Mock };
    player: { findUnique: jest.Mock; update: jest.Mock };
  };
  let jwtService: { verify: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let roomEmitMock: jest.Mock;
  let serverEmitMock: jest.Mock;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      player: {
        findUnique: jest.fn().mockResolvedValue({
          locationId: 'madrid_centro',
          jailUntil: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    jwtService = { verify: jest.fn() };
    configService = { getOrThrow: jest.fn().mockReturnValue('test-secret') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);

    roomEmitMock = jest.fn();
    serverEmitMock = jest.fn();
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: roomEmitMock }),
      emit: serverEmitMock,
    } as any;
  });

  afterEach(() => {
    gateway.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const createMockSocket = (overrides: Record<string, any> = {}) => {
    const toEmit = jest.fn();
    return {
      id: 'sock-1',
      handshake: { auth: { token: 'valid-token' }, headers: {} },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: toEmit }),
      _toEmit: toEmit,
      ...overrides,
    } as any;
  };

  const connectPlayer = async (
    socketId = 'sock-1',
    userId = 'user-1',
    playerId = 'player-1',
    displayName = 'El Rubio',
    locationId = 'madrid_centro',
  ) => {
    jwtService.verify.mockReturnValue({ sub: userId });
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      player: { id: playerId, displayName, locationId },
    });
    const client = createMockSocket({ id: socketId });
    await gateway.handleConnection(client);
    return client;
  };

  describe('handlePlayerMove', () => {
    it('updates spatial state on valid move and emits world:snapshot on tick', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const client = await connectPlayer();
      // Clear initial dirty flag from connection
      gateway.flushWorldSnapshots();
      roomEmitMock.mockClear();

      jest.advanceTimersByTime(100);
      const res = gateway.handlePlayerMove(client, {
        x: 5,
        y: 0,
        z: 3,
        rotY: 1.5,
        anim: 'run',
        vehicleId: 'veh-1',
      });

      expect(res).toEqual({ ok: true });

      gateway.flushWorldSnapshots();

      expect(gateway.server.to).toHaveBeenCalledWith('zone:madrid_centro');
      expect(roomEmitMock).toHaveBeenCalledWith(
        'world:snapshot',
        expect.objectContaining({
          locationId: 'madrid_centro',
          players: [
            {
              playerId: 'player-1',
              displayName: 'El Rubio',
              x: 5,
              y: 0,
              z: 3,
              rotY: 1.5,
              anim: 'run',
              vehicleId: 'veh-1',
            },
          ],
        }),
      );

      // Second flush without movement should not emit anything
      roomEmitMock.mockClear();
      gateway.flushWorldSnapshots();
      expect(roomEmitMock).not.toHaveBeenCalled();
    });

    it('rate-limits moves faster than 40ms', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const client = await connectPlayer();

      const first = gateway.handlePlayerMove(client, {
        x: 1,
        y: 0,
        z: 1,
        rotY: 0,
        anim: 'walk',
      });
      expect(first).toEqual({ ok: true });

      // Advance only 20ms (< 40ms)
      jest.advanceTimersByTime(20);
      const second = gateway.handlePlayerMove(client, {
        x: 2,
        y: 0,
        z: 2,
        rotY: 0,
        anim: 'walk',
      });
      expect(second).toEqual({ ok: false, reason: 'rate_limited' });

      // Advance another 25ms (total 45ms >= 40ms)
      jest.advanceTimersByTime(25);
      const third = gateway.handlePlayerMove(client, {
        x: 2,
        y: 0,
        z: 2,
        rotY: 0,
        anim: 'walk',
      });
      expect(third).toEqual({ ok: true });
    });

    it('rejects absurd teleport exceeding 60 units/sec', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const client = await connectPlayer();

      // Valid initial move near spawn
      expect(
        gateway.handlePlayerMove(client, {
          x: 2,
          y: 0,
          z: 0,
          rotY: 0,
          anim: 'walk',
        }),
      ).toEqual({ ok: true });

      // 100ms later -> max allowed distance is 6 units (60 * 0.1s)
      jest.advanceTimersByTime(100);
      const teleport = gateway.handlePlayerMove(client, {
        x: 100,
        y: 0,
        z: 0,
        rotY: 0,
        anim: 'run',
      });

      expect(teleport).toEqual({ ok: false, reason: 'speed_limit_exceeded' });

      // Verify state remained at x: 2
      gateway.flushWorldSnapshots();
      expect(roomEmitMock).toHaveBeenCalledWith(
        'world:snapshot',
        expect.objectContaining({
          players: [expect.objectContaining({ playerId: 'player-1', x: 2 })],
        }),
      );
    });

    it('returns error when socket is not authenticated', () => {
      const unauthSocket = createMockSocket({ id: 'unauth' });
      const res = gateway.handlePlayerMove(unauthSocket, {
        x: 1,
        y: 0,
        z: 1,
        rotY: 0,
      });
      expect(res).toEqual({ ok: false, error: 'Not authenticated' });
    });
  });

  describe('handleJoinZone', () => {
    it('resets spatial state to spawn and emits initial world:snapshot', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const client = await connectPlayer();
      gateway.handlePlayerMove(client, {
        x: 10,
        y: 0,
        z: 10,
        rotY: 1,
        anim: 'run',
      });

      client.emit.mockClear();
      const res = await gateway.handleJoinZone(client, {
        locationId: 'malasana',
      });

      expect(res).toEqual(
        expect.objectContaining({ ok: true, locationId: 'malasana' }),
      );
      expect(client.emit).toHaveBeenCalledWith(
        'world:snapshot',
        expect.objectContaining({
          locationId: 'malasana',
          players: [
            expect.objectContaining({
              playerId: 'player-1',
              x: 0,
              y: 0,
              z: 0,
              rotY: 0,
              anim: 'idle',
            }),
          ],
        }),
      );
    });

    it('blocks free cross-city teleportation unless DB locationId already matches /world/travel', async () => {
      const client = await connectPlayer();
      prisma.player.findUnique.mockResolvedValue({
        locationId: 'madrid_centro',
        jailUntil: null,
      });

      const blocked = await gateway.handleJoinZone(client, {
        locationId: 'barcelona_ramblas',
      });
      expect(blocked).toEqual({ error: 'Intercity travel requires /world/travel' });

      // When /world/travel already updated DB locationId, zone:join succeeds
      prisma.player.findUnique.mockResolvedValue({
        locationId: 'barcelona_ramblas',
        jailUntil: null,
      });
      const allowed = await gateway.handleJoinZone(client, {
        locationId: 'barcelona_ramblas',
      });
      expect(allowed).toEqual(
        expect.objectContaining({ ok: true, locationId: 'barcelona_ramblas' }),
      );
    });
  });

  describe('lifecycle and cleanup', () => {
    it('removes presence on disconnect and cleans up timers onModuleDestroy', async () => {
      jest.useFakeTimers();
      const client = await connectPlayer();

      gateway.onModuleInit();
      expect((gateway as any).tickTimer).toBeDefined();

      // Advance 100ms to trigger tick loop automatically
      gateway.handlePlayerMove(client, {
        x: 1,
        y: 0,
        z: 0,
        rotY: 0,
        anim: 'walk',
      });
      roomEmitMock.mockClear();
      jest.advanceTimersByTime(100);
      expect(roomEmitMock).toHaveBeenCalledWith(
        'world:snapshot',
        expect.objectContaining({ locationId: 'madrid_centro' }),
      );

      await gateway.handleDisconnect(client);
      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: 'player-1' },
        data: { isOnline: false },
      });

      // After disconnect, move should fail with Presence not found
      const moveAfterDisconnect = gateway.handlePlayerMove(client, {
        x: 2,
        y: 0,
        z: 0,
        rotY: 0,
      });
      expect(moveAfterDisconnect).toEqual({
        ok: false,
        error: 'Presence not found',
      });

      gateway.onModuleDestroy();
      expect((gateway as any).tickTimer).toBeUndefined();
      expect((gateway as any).worldEventTimer).toBeUndefined();
    });
  });

  describe('chat rate limiting', () => {
    it('rate-limits chat:zone messages faster than 500ms per socket', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const client = await connectPlayer();
      roomEmitMock.mockClear();

      const first = await gateway.handleZoneChat(client, { message: 'Hola!' });
      expect(first).toEqual(expect.objectContaining({ ok: true, message: 'Hola!' }));
      expect(roomEmitMock).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(250);
      const second = await gateway.handleZoneChat(client, { message: 'Spam!' });
      expect(second).toEqual({
        ok: false,
        error: 'Rate limit exceeded',
        reason: 'rate_limited',
      });
      expect(roomEmitMock).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(300);
      const third = await gateway.handleZoneChat(client, {
        message: 'Ya puedo!',
      });
      expect(third).toEqual(
        expect.objectContaining({ ok: true, message: 'Ya puedo!' }),
      );
      expect(roomEmitMock).toHaveBeenCalledTimes(2);
    });

    it('rate-limits chat:global messages faster than 500ms per socket', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const client = await connectPlayer();
      serverEmitMock.mockClear();

      const first = await gateway.handleGlobalChat(client, {
        message: 'Global 1',
      });
      expect(first).toEqual(
        expect.objectContaining({ ok: true, message: 'Global 1' }),
      );
      expect(serverEmitMock).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(499);
      const second = await gateway.handleGlobalChat(client, {
        message: 'Global spam',
      });
      expect(second).toEqual({
        ok: false,
        error: 'Rate limit exceeded',
        reason: 'rate_limited',
      });
      expect(serverEmitMock).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1);
      const third = await gateway.handleGlobalChat(client, {
        message: 'Global 2',
      });
      expect(third).toEqual(
        expect.objectContaining({ ok: true, message: 'Global 2' }),
      );
      expect(serverEmitMock).toHaveBeenCalledTimes(2);
    });
  });
});
