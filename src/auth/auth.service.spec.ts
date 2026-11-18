import { BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService (Guest Mode & Referrals)', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    player: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    refreshToken: { create: jest.Mock };
    transactionLog: { create: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      player: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      },
      transactionLog: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };

    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-token'),
    } as unknown as JwtService;

    const configService = {
      get: jest.fn((key: string) =>
        key === 'JWT_SECRET' ? 'test-secret' : undefined,
      ),
    } as unknown as ConfigService;

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService,
      configService,
    );
  });

  it('guestLogin creates an isGuest user with starter euros/VC without paying out referrer yet', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'ref-player-1' });
    prisma.user.create.mockResolvedValue({
      id: 'u-guest',
      email: 'invitado@guest.vidaloca.local',
      username: 'invitado_abc123',
      role: 'PLAYER',
      isGuest: true,
      tokenVersion: 0,
    });
    prisma.player.create.mockResolvedValue({
      id: 'p-guest',
      displayName: 'Visitante ABC123',
      euros: 250,
      vidaCoins: 5,
      referredByPlayerId: 'ref-player-1',
    });

    const res = await service.guestLogin(
      { referralCode: 'VL-REF123' },
      '1.2.3.4',
    );

    expect(res.user.isGuest).toBe(true);
    expect(res.accessToken).toBe('mock-token');
    expect(prisma.player.update).not.toHaveBeenCalled();
    expect(prisma.transactionLog.createMany).not.toHaveBeenCalled();
  });

  it('convertGuest rejects already permanent accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      isGuest: false,
      player: { id: 'p-1' },
    });

    await expect(
      service.convertGuest('u-1', {
        email: 'real@vidaloca.es',
        username: 'RealUser',
        password: 'password123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('convertGuest rejects duplicate email/username and pays referral bonuses when converted', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-guest',
      isGuest: true,
      player: {
        id: 'p-guest',
        displayName: 'Visitante',
        referredByPlayerId: 'ref-player-1',
      },
    });
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'other-user' });

    await expect(
      service.convertGuest('u-guest', {
        email: 'taken@vidaloca.es',
        username: 'TakenName',
        password: 'password123',
      }),
    ).rejects.toThrow(ConflictException);

    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValue({
      id: 'u-guest',
      email: 'new@vidaloca.es',
      username: 'NewHero',
      role: 'PLAYER',
      isGuest: false,
    });
    prisma.player.update
      .mockResolvedValueOnce({
        id: 'p-guest',
        displayName: 'NewHero',
        euros: 2250,
        vidaCoins: 30,
      })
      .mockResolvedValueOnce({
        id: 'ref-player-1',
        euros: 5000,
        vidaCoins: 50,
      });

    const converted = await service.convertGuest('u-guest', {
      email: 'new@vidaloca.es',
      username: 'NewHero',
      password: 'password123',
    });

    expect(converted.user.isGuest).toBe(false);
    expect(prisma.player.update).toHaveBeenCalledTimes(2);
    expect(prisma.transactionLog.createMany).toHaveBeenCalledTimes(1);
  });
});
