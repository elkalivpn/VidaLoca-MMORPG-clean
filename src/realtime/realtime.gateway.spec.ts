import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { WorldService } from '../world/world.service';

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
              hp: 100,
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

  describe('combat:pvp-hit', () => {
    it('applies authoritative SHOT/MELEE damage, emits combat:damaged, and updates snapshot hp', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const attacker = await connectPlayer(
        'sock-att',
        'user-att',
        'player-att',
        'El Rubio',
        'madrid_centro',
      );
      const target = await connectPlayer(
        'sock-tgt',
        'user-tgt',
        'player-tgt',
        'El Cobra',
        'madrid_centro',
      );

      gateway.handlePlayerMove(attacker, { x: 0, y: 0, z: 0, rotY: 0 });
      gateway.handlePlayerMove(target, { x: 3, y: 0, z: 4, rotY: 0 });
      gateway.flushWorldSnapshots();
      roomEmitMock.mockClear();

      jest.spyOn(Math, 'random').mockReturnValue(0.5); // SHOT: 24 + 6 = 30
      const shotRes = await gateway.handleCombatPvpHit(attacker, {
        targetPlayerId: 'player-tgt',
        attackType: 'SHOT',
        weaponType: 'PISTOL',
      });

      expect(shotRes).toEqual(
        expect.objectContaining({
          ok: true,
          attackerId: 'player-att',
          attackerName: 'El Rubio',
          targetPlayerId: 'player-tgt',
          targetName: 'El Cobra',
          attackType: 'SHOT',
          damage: 30,
          remainingHp: 70,
          knockout: false,
          lootEuros: 0,
          x: 3,
          z: 4,
        }),
      );
      expect(gateway.server.to).toHaveBeenCalledWith('zone:madrid_centro');
      expect(roomEmitMock).toHaveBeenCalledWith(
        'combat:damaged',
        expect.objectContaining({
          targetPlayerId: 'player-tgt',
          damage: 30,
          remainingHp: 70,
          knockout: false,
        }),
      );

      // Snapshot reflects updated hp
      roomEmitMock.mockClear();
      gateway.flushWorldSnapshots();
      expect(roomEmitMock).toHaveBeenCalledWith(
        'world:snapshot',
        expect.objectContaining({
          players: expect.arrayContaining([
            expect.objectContaining({ playerId: 'player-tgt', hp: 70 }),
          ]),
        }),
      );
    });

    it('rejects self-target, different zone, out-of-range attacks, and enforces 350ms rate limit', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const attacker = await connectPlayer(
        'sock-att',
        'user-att',
        'player-att',
        'El Rubio',
        'madrid_centro',
      );
      const target = await connectPlayer(
        'sock-tgt',
        'user-tgt',
        'player-tgt',
        'El Cobra',
        'madrid_centro',
      );
      await connectPlayer(
        'sock-far-zone',
        'user-other',
        'player-other',
        'Sombra',
        'malasana',
      );

      expect(
        await gateway.handleCombatPvpHit(attacker, {
          targetPlayerId: 'player-att',
          attackType: 'MELEE',
        }),
      ).toEqual({ ok: false, error: 'Cannot target yourself' });

      expect(
        await gateway.handleCombatPvpHit(attacker, {
          targetPlayerId: 'player-other',
          attackType: 'SHOT',
        }),
      ).toEqual({ ok: false, error: 'Target player is in a different zone' });

      // Move target 10 units away (> 6.5 MELEE max range, <= 65 SHOT max range)
      gateway.handlePlayerMove(attacker, { x: 0, y: 0, z: 0, rotY: 0 });
      gateway.handlePlayerMove(target, { x: 10, y: 0, z: 0, rotY: 0 });

      expect(
        await gateway.handleCombatPvpHit(attacker, {
          targetPlayerId: 'player-tgt',
          attackType: 'MELEE',
        }),
      ).toEqual({ ok: false, reason: 'out_of_range' });

      // Valid SHOT at distance 10
      const firstHit = await gateway.handleCombatPvpHit(attacker, {
        targetPlayerId: 'player-tgt',
        attackType: 'SHOT',
      });
      expect(firstHit).toEqual(expect.objectContaining({ ok: true }));

      // Second hit after 200ms (< 350ms) is rate-limited
      jest.advanceTimersByTime(200);
      expect(
        await gateway.handleCombatPvpHit(attacker, {
          targetPlayerId: 'player-tgt',
          attackType: 'SHOT',
        }),
      ).toEqual({ ok: false, reason: 'rate_limited' });

      // Third hit after +150ms (total 350ms) succeeds
      jest.advanceTimersByTime(150);
      expect(
        await gateway.handleCombatPvpHit(attacker, {
          targetPlayerId: 'player-tgt',
          attackType: 'SHOT',
        }),
      ).toEqual(expect.objectContaining({ ok: true }));
    });

    it('resolves knockout via WorldService, resets HP to 100, and emits pvp_ko world:event', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const worldServiceMock = {
        resolvePvpKnockout: jest.fn().mockResolvedValue({
          lootEuros: 45,
          attackerStats: {
            level: 2,
            xp: 150,
            euros: 545,
            reputation: 30,
            heat: 20,
            wantedLevel: 1,
          },
          targetRemainingEuros: 0,
        }),
      };

      const pvpModule = await Test.createTestingModule({
        providers: [
          RealtimeGateway,
          { provide: JwtService, useValue: jwtService },
          { provide: ConfigService, useValue: configService },
          { provide: PrismaService, useValue: prisma },
          { provide: WorldService, useValue: worldServiceMock },
        ],
      }).compile();

      const pvpGateway = pvpModule.get<RealtimeGateway>(RealtimeGateway);
      const pvpRoomEmit = jest.fn();
      pvpGateway.server = {
        to: jest.fn().mockReturnValue({ emit: pvpRoomEmit }),
        emit: jest.fn(),
      } as any;

      jwtService.verify.mockReturnValue({ sub: 'user-att' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-att',
        player: {
          id: 'player-att',
          displayName: 'El Rubio',
          locationId: 'madrid_centro',
        },
      });
      const attacker = createMockSocket({ id: 'sock-att' });
      await pvpGateway.handleConnection(attacker);

      jwtService.verify.mockReturnValue({ sub: 'user-tgt' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-tgt',
        player: {
          id: 'player-tgt',
          displayName: 'El Cobra',
          locationId: 'madrid_centro',
        },
      });
      const target = createMockSocket({ id: 'sock-tgt' });
      await pvpGateway.handleConnection(target);

      // Lower target HP to 20 so next MELEE hit (18..28) knocks out with random = 0.5 -> 23
      (pvpGateway as any).presence.get('sock-tgt').hp = 20;
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      pvpRoomEmit.mockClear();

      const koRes = await pvpGateway.handleCombatPvpHit(attacker, {
        targetPlayerId: 'player-tgt',
        attackType: 'MELEE',
      });

      expect(worldServiceMock.resolvePvpKnockout).toHaveBeenCalledWith(
        'user-att',
        'user-tgt',
      );
      expect(koRes).toEqual(
        expect.objectContaining({
          ok: true,
          damage: 23,
          remainingHp: 100,
          knockout: true,
          lootEuros: 45,
          attackerStats: expect.objectContaining({ euros: 545, xp: 150 }),
        }),
      );
      expect((pvpGateway as any).presence.get('sock-tgt').hp).toBe(100);
      expect(pvpRoomEmit).toHaveBeenCalledWith(
        'combat:damaged',
        expect.objectContaining({
          knockout: true,
          remainingHp: 100,
          lootEuros: 45,
        }),
      );
      expect(pvpRoomEmit).toHaveBeenCalledWith(
        'world:event',
        expect.objectContaining({
          type: 'pvp_ko',
          attackerId: 'player-att',
          targetPlayerId: 'player-tgt',
          lootEuros: 45,
        }),
      );

      // Verify DB error during knockout resolution is caught safely
      (pvpGateway as any).presence.get('sock-tgt').hp = 10;
      worldServiceMock.resolvePvpKnockout.mockRejectedValueOnce(
        new Error('DB timeout'),
      );
      jest.advanceTimersByTime(400);

      const safeRes = await pvpGateway.handleCombatPvpHit(attacker, {
        targetPlayerId: 'player-tgt',
        attackType: 'MELEE',
      });
      expect(safeRes).toEqual(
        expect.objectContaining({
          ok: true,
          knockout: true,
          remainingHp: 100,
          lootEuros: 0,
        }),
      );

      pvpGateway.onModuleDestroy();
    });

    it('deduplicates same playerId when connected via multiple sockets in world:snapshot', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      await connectPlayer('sock-dup-1', 'user-dup', 'player-dup', 'Dupli', 'madrid_centro');
      await connectPlayer('sock-dup-2', 'user-dup', 'player-dup', 'Dupli', 'madrid_centro');

      roomEmitMock.mockClear();
      gateway.flushWorldSnapshots();

      expect(roomEmitMock).toHaveBeenCalledWith(
        'world:snapshot',
        expect.objectContaining({
          locationId: 'madrid_centro',
          players: [expect.objectContaining({ playerId: 'player-dup' })],
        }),
      );
      const snapshotPayload = roomEmitMock.mock.calls.find(
        ([event]) => event === 'world:snapshot',
      )?.[1];
      expect(snapshotPayload.players).toHaveLength(1);
    });
  });
});

