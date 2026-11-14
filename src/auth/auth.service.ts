import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_MINUTES = 15;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Optional() private auditService?: SecurityAuditService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async register(registerDto: RegisterDto, ip?: string) {
    const email = registerDto.email.trim().toLowerCase();
    const username = registerDto.username.trim();
    const displayName = registerDto.displayName.trim();
    const { password } = registerDto;

    // Check if user exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email or username already exists');
    }

    // Hash password with cost 12
    const hashedPassword = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

    // Create user and player in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          role: 'PLAYER',
        },
      });

      const player = await tx.player.create({
        data: {
          userId: newUser.id,
          displayName,
          euros: 100.0,
          vidaCoins: 0,
          locationId: 'madrid_centro',
        },
      });

      return { ...newUser, player };
    });

    const tokens = await this.generateTokens(user.id, user.tokenVersion);
    await this.storeRefreshToken(user.id, tokens.refreshToken, ip);

    await this.auditService?.logEvent({
      actorId: user.id,
      eventType: 'AUTH_REGISTER',
      severity: 'INFO',
      ip,
      details: { username: user.username },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        player: user.player,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto, ip?: string) {
    const email = loginDto.email.trim().toLowerCase();
    const { password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { player: true },
    });

    if (!user) {
      await this.auditService?.logEvent({
        eventType: 'AUTH_LOGIN_UNKNOWN_EMAIL',
        severity: 'WARN',
        ip,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBanned) {
      await this.auditService?.logEvent({
        actorId: user.id,
        eventType: 'AUTH_LOGIN_BANNED_BLOCKED',
        severity: 'HIGH',
        ip,
      });
      throw new ForbiddenException(
        user.banReason || 'Cuenta suspendida por seguridad',
      );
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const waitMin = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      throw new ForbiddenException(
        `Cuenta bloqueada temporalmente por intentos fallidos. Intenta en ${waitMin} min.`,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const shouldLock = nextAttempts >= this.MAX_FAILED_ATTEMPTS;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + this.LOCKOUT_MINUTES * 60_000)
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : nextAttempts,
          lockedUntil,
        },
      });

      await this.auditService?.logEvent({
        actorId: user.id,
        eventType: shouldLock ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_LOGIN_FAILED',
        severity: shouldLock ? 'HIGH' : 'WARN',
        ip,
        details: { attempts: nextAttempts },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const tokens = await this.generateTokens(user.id, user.tokenVersion);
    await this.storeRefreshToken(user.id, tokens.refreshToken, ip);

    // Update last login
    await this.prisma.player.updateMany({
      where: { userId: user.id },
      data: { lastLogin: new Date(), isOnline: true },
    });

    await this.auditService?.logEvent({
      actorId: user.id,
      eventType: 'AUTH_LOGIN_SUCCESS',
      severity: 'INFO',
      ip,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        player: user.player,
      },
      ...tokens,
    };
  }

  async logout(userId: string, refreshToken?: string, ip?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          OR: [{ token: tokenHash }, { token: refreshToken }],
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revoke all active refresh tokens if none supplied
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.prisma.player.updateMany({
      where: { userId },
      data: { isOnline: false },
    });

    await this.auditService?.logEvent({
      actorId: userId,
      eventType: 'AUTH_LOGOUT',
      severity: 'INFO',
      ip,
    });

    return { message: 'Logged out successfully' };
  }

  async refreshTokens(refreshToken: string, ip?: string) {
    const tokenHash = this.hashToken(refreshToken);

    let payload: any;
    try {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      payload = this.jwtService.verify(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload?.tokenType && payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid token type for refresh');
    }

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        OR: [{ token: tokenHash }, { token: refreshToken }],
      },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Reuse detection: if an already-revoked refresh token is presented, revoke all user sessions!
    if (tokenRecord.revokedAt) {
      await this.prisma.$transaction([
        this.prisma.refreshToken.updateMany({
          where: { userId: tokenRecord.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
        this.prisma.user.update({
          where: { id: tokenRecord.userId },
          data: { tokenVersion: { increment: 1 } },
        }),
      ]);
      await this.auditService?.logEvent({
        actorId: tokenRecord.userId,
        eventType: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
        severity: 'CRITICAL',
        ip,
      });
      throw new UnauthorizedException('Refresh token reuse detected; all sessions revoked');
    }

    if (tokenRecord.user.isBanned) {
      throw new ForbiddenException('Cuenta suspendida por seguridad');
    }

    // Rotate refresh token atomically
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(
      tokenRecord.userId,
      tokenRecord.user.tokenVersion,
    );
    await this.storeRefreshToken(tokenRecord.userId, tokens.refreshToken, ip);

    return tokens;
  }

  private async generateTokens(userId: string, tokenVersion = 0) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          tokenType: 'access',
          tv: tokenVersion,
          jti: randomUUID(),
        },
        { expiresIn: '1h' },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          tokenType: 'refresh',
          tv: tokenVersion,
          jti: randomUUID(),
        },
        { expiresIn: '7d' },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
    ip?: string,
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token: this.hashToken(refreshToken),
        userId,
        ipHash: this.auditService?.hashIdentifier(ip) ?? null,
        expiresAt,
      },
    });
  }

  async validateUser(userId: string, tokenVersion?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { player: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isBanned) {
      throw new ForbiddenException('Cuenta suspendida por seguridad');
    }

    if (
      typeof tokenVersion === 'number' &&
      user.tokenVersion !== tokenVersion
    ) {
      throw new UnauthorizedException('Sesión revocada');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      player: user.player,
    };
  }
}
