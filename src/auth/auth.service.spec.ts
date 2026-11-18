import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService (Guest Mode, Referrals, Legal Consent & Password Reset)', () => {
  let service: AuthService;
  let configMap: Record<string, string | undefined>;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    player: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    refreshToken: { create: jest.Mock; updateMany: jest.Mock };
    passwordResetToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    transactionLog: { create: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    configMap = {
      JWT_SECRET: 'test-secret',
      NODE_ENV: 'test',
      FRONTEND_URL: 'https://vidaloca.nexusaiholding.com',
    };

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
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'prt-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      get: jest.fn((key: string) => configMap[key]),
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
      acceptedTerms: true,
      isAdultConfirmed: true,
    });

    expect(converted.user.isGuest).toBe(false);
    expect(prisma.player.update).toHaveBeenCalledTimes(2);
    expect(prisma.transactionLog.createMany).toHaveBeenCalledTimes(1);
  });

  it('register rejects explicit false acceptedTerms or isAdultConfirmed', async () => {
    await expect(
      service.register({
        email: 'minor@vidaloca.es',
        username: 'YoungUser',
        password: 'Password123',
        displayName: 'YoungUser',
        acceptedTerms: false,
        isAdultConfirmed: true,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.register({
        email: 'minor@vidaloca.es',
        username: 'YoungUser',
        password: 'Password123',
        displayName: 'YoungUser',
        acceptedTerms: true,
        isAdultConfirmed: false,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requestPasswordReset returns generic message for unknown or guest users without creating tokens', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const unknownRes = await service.requestPasswordReset({
      email: 'nobody@vidaloca.es',
    });
    expect(unknownRes.message).toContain('Si existe una cuenta permanente');
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-guest',
      email: 'invitado@guest.vidaloca.local',
      username: 'invitado_1',
      isGuest: true,
      isBanned: false,
    });
    const guestRes = await service.requestPasswordReset({
      email: 'invitado@guest.vidaloca.local',
    });
    expect(guestRes.message).toContain('Si existe una cuenta permanente');
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('requestPasswordReset stores SHA-256 tokenHash only and hides devResetUrl in production', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'player@vidaloca.es',
      username: 'ElHalcon',
      isGuest: false,
      isBanned: false,
    });

    const devRes = await service.requestPasswordReset(
      { email: 'PLAYER@vidaloca.es' },
      '10.0.0.1',
    );
    expect(devRes.devResetUrl).toContain(
      'https://vidaloca.nexusaiholding.com/reset-password?token=',
    );
    const rawToken = devRes.devResetUrl!.split('token=')[1];
    const expectedHash = createHash('sha256').update(rawToken).digest('hex');

    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u-1',
          tokenHash: expectedHash,
        }),
      }),
    );

    configMap.NODE_ENV = 'production';
    const prodRes = await service.requestPasswordReset({
      email: 'player@vidaloca.es',
    });
    expect(prodRes).not.toHaveProperty('devResetUrl');
  });

  it('resetPassword rejects invalid, expired, used, or banned tokens', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.resetPassword({
        token: 'a'.repeat(64),
        newPassword: 'NewPassword123',
      }),
    ).rejects.toThrow(BadRequestException);

    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'prt-used',
      userId: 'u-1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u-1', isGuest: false, isBanned: false },
    });
    await expect(
      service.resetPassword({
        token: 'a'.repeat(64),
        newPassword: 'NewPassword123',
      }),
    ).rejects.toThrow(BadRequestException);

    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'prt-expired',
      userId: 'u-1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
      user: { id: 'u-1', isGuest: false, isBanned: false },
    });
    await expect(
      service.resetPassword({
        token: 'a'.repeat(64),
        newPassword: 'NewPassword123',
      }),
    ).rejects.toThrow(BadRequestException);

    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'prt-banned',
      userId: 'u-banned',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u-banned', isGuest: false, isBanned: true },
    });
    await expect(
      service.resetPassword({
        token: 'a'.repeat(64),
        newPassword: 'NewPassword123',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('resetPassword hashes new password, revokes refresh tokens, and bumps tokenVersion', async () => {
    const rawToken = 'b'.repeat(64);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'prt-valid',
      userId: 'u-1',
      tokenHash,
      usedAt: null,
      expiresAt: new Date(Date.now() + 15 * 60_000),
      user: { id: 'u-1', isGuest: false, isBanned: false },
    });
    prisma.passwordResetToken.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.user.update.mockResolvedValue({ id: 'u-1' });

    const res = await service.resetPassword(
      {
        token: rawToken,
        newPassword: 'StrongPassword99',
      },
      '10.0.0.2',
    );

    expect(res.message).toContain('Contraseña actualizada correctamente');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1' },
        data: expect.objectContaining({
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      }),
    );
    const updateCall = prisma.user.update.mock.calls[0][0] as {
      data: { password: string };
    };
    await expect(
      bcrypt.compare('StrongPassword99', updateCall.data.password),
    ).resolves.toBe(true);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u-1', revokedAt: null },
      }),
    );
  });
});
