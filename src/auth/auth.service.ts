import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityAuditService } from '../security/security-audit.service';
import {
  RegisterDto,
  LoginDto,
  GuestLoginDto,
  ConvertGuestDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 12;
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_MINUTES = 15;
  private readonly RESET_TOKEN_TTL_MINUTES = 30;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Optional() private auditService?: SecurityAuditService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private createReferralCode(): string {
    return `VL-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  async register(registerDto: RegisterDto, ip?: string) {
    if (
      registerDto.acceptedTerms === false ||
      registerDto.isAdultConfirmed === false
    ) {
      throw new BadRequestException(
        'Debes confirmar ser mayor de 18 años (+18) y aceptar los Términos y Política de Privacidad',
      );
    }

    const email = registerDto.email.trim().toLowerCase();
    const username = registerDto.username.trim();
    const displayName = registerDto.displayName.trim();
    const { password } = registerDto;
    const rawRef = registerDto.referralCode?.trim().toUpperCase();
    const consentAt = new Date();

    // Check if user exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email or username already exists');
    }

    const referrer = rawRef
      ? await this.prisma.player.findUnique({
          where: { referralCode: rawRef },
          select: { id: true, displayName: true },
        })
      : null;

    // Hash password with cost 12
    const hashedPassword = await bcrypt.hash(password, this.BCRYPT_ROUNDS);
    const ownRefCode = this.createReferralCode();

    // Create user and player in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          role: 'PLAYER',
          isGuest: false,
          ...(registerDto.acceptedTerms ? { termsAcceptedAt: consentAt } : {}),
          ...(registerDto.isAdultConfirmed ? { ageVerifiedAt: consentAt } : {}),
        },
      });

      const player = await tx.player.create({
        data: {
          userId: newUser.id,
          displayName,
          euros: referrer ? 1600.0 : 100.0,
          vidaCoins: referrer ? 15 : 0,
          locationId: 'madrid_centro',
          referralCode: ownRefCode,
          referredByPlayerId: referrer?.id ?? null,
        },
      });

      if (referrer) {
        await tx.player.update({
          where: { id: referrer.id },
          data: {
            euros: { increment: 2500 },
            vidaCoins: { increment: 25 },
          },
        });
        await tx.transactionLog.createMany({
          data: [
            {
              playerId: referrer.id,
              type: 'GIFT',
              amount: 2500,
              currency: 'EUR',
              reason: `Referido reclutado: ${displayName}`,
              reference: player.id,
            },
            {
              playerId: referrer.id,
              type: 'GIFT',
              amount: 25,
              currency: 'VIDACOIN',
              reason: `Bono VidaCoins por referido: ${displayName}`,
              reference: player.id,
            },
            {
              playerId: player.id,
              type: 'GIFT',
              amount: 15,
              currency: 'VIDACOIN',
              reason: `Bienvenida por código ${rawRef}`,
              reference: referrer.id,
            },
          ],
        });
      }

      return { ...newUser, player };
    });

    const tokens = await this.generateTokens(user.id, user.tokenVersion);
    await this.storeRefreshToken(user.id, tokens.refreshToken, ip);

    await this.auditService?.logEvent({
      actorId: user.id,
      eventType: 'AUTH_REGISTER',
      severity: 'INFO',
      ip,
      details: { username: user.username, referred: Boolean(referrer) },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isGuest: user.isGuest,
        player: user.player,
      },
      ...tokens,
    };
  }

  async guestLogin(dto: GuestLoginDto, ip?: string) {
    const suffix = randomBytes(3).toString('hex');
    const username = `invitado_${suffix}`;
    const email = `${username}_${randomUUID().slice(0, 6)}@guest.vidaloca.local`;
    const displayName =
      dto.displayName?.trim() || `Visitante ${suffix.toUpperCase()}`;
    const rawPassword = randomBytes(24).toString('hex');
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const rawRef = dto.referralCode?.trim().toUpperCase();

    const referrer = rawRef
      ? await this.prisma.player.findUnique({
          where: { referralCode: rawRef },
          select: { id: true },
        })
      : null;

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          role: 'PLAYER',
          isGuest: true,
        },
      });

      const player = await tx.player.create({
        data: {
          userId: newUser.id,
          displayName,
          euros: 250.0,
          vidaCoins: 5,
          locationId: 'madrid_centro',
          referralCode: this.createReferralCode(),
          referredByPlayerId: referrer?.id ?? null,
        },
      });

      return { ...newUser, player };
    });

    const tokens = await this.generateTokens(user.id, user.tokenVersion);
    await this.storeRefreshToken(user.id, tokens.refreshToken, ip);

    await this.auditService?.logEvent({
      actorId: user.id,
      eventType: 'AUTH_GUEST_LOGIN',
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
        isGuest: user.isGuest,
        player: user.player,
      },
      ...tokens,
    };
  }

  async convertGuest(userId: string, dto: ConvertGuestDto, ip?: string) {
    if (dto.acceptedTerms === false || dto.isAdultConfirmed === false) {
      throw new BadRequestException(
        'Debes confirmar ser mayor de 18 años (+18) y aceptar los Términos y Política de Privacidad',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { player: true },
    });

    if (!existing || !existing.player) {
      throw new UnauthorizedException('User not found');
    }
    if (!existing.isGuest) {
      throw new BadRequestException('Esta cuenta ya es permanente');
    }

    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();
    const conflict = await this.prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: [{ email }, { username }],
      },
    });
    if (conflict) {
      throw new ConflictException('Email or username already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);
    const displayName = dto.displayName?.trim() || existing.player.displayName;
    const referrerId = existing.player.referredByPlayerId;
    const consentAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          email,
          username,
          password: hashedPassword,
          isGuest: false,
          ...(dto.acceptedTerms ? { termsAcceptedAt: consentAt } : {}),
          ...(dto.isAdultConfirmed ? { ageVerifiedAt: consentAt } : {}),
        },
      });

      const player = await tx.player.update({
        where: { id: existing.player!.id },
        data: {
          displayName,
          euros: { increment: referrerId ? 2000 : 500 },
          vidaCoins: { increment: referrerId ? 25 : 10 },
        },
      });

      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'GIFT',
          amount: referrerId ? 2000 : 500,
          currency: 'EUR',
          reason: 'Bono por convertir cuenta invitado a permanente',
        },
      });

      if (referrerId && referrerId !== player.id) {
        await tx.player.update({
          where: { id: referrerId },
          data: {
            euros: { increment: 2500 },
            vidaCoins: { increment: 25 },
          },
        });
        await tx.transactionLog.createMany({
          data: [
            {
              playerId: referrerId,
              type: 'GIFT',
              amount: 2500,
              currency: 'EUR',
              reason: `Referido convertido: ${displayName}`,
              reference: player.id,
            },
            {
              playerId: referrerId,
              type: 'GIFT',
              amount: 25,
              currency: 'VIDACOIN',
              reason: `Bono VidaCoins por referido: ${displayName}`,
              reference: player.id,
            },
          ],
        });
      }

      return { ...updatedUser, player };
    });

    await this.auditService?.logEvent({
      actorId: userId,
      eventType: 'AUTH_GUEST_CONVERTED',
      severity: 'INFO',
      ip,
      details: { username },
    });

    return {
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        role: updated.role,
        isGuest: updated.isGuest,
        player: updated.player,
      },
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

    let payload: { tokenType?: string; sub?: string };
    try {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      payload = this.jwtService.verify<{ tokenType?: string; sub?: string }>(
        refreshToken,
        { secret },
      );
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
      throw new UnauthorizedException(
        'Refresh token reuse detected; all sessions revoked',
      );
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

  async requestPasswordReset(dto: ForgotPasswordDto, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const genericMessage =
      'Si existe una cuenta permanente asociada a ese correo, recibirás instrucciones para restablecer tu contraseña en los próximos minutos.';

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        isGuest: true,
        isBanned: true,
      },
    });

    if (!user || user.isGuest || user.isBanned) {
      if (user?.isBanned) {
        await this.auditService?.logEvent({
          actorId: user.id,
          eventType: 'AUTH_PASSWORD_RESET_BANNED_BLOCKED',
          severity: 'WARN',
          ip,
        });
      }
      return { message: genericMessage };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.RESET_TOKEN_TTL_MINUTES * 60_000,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          requestedIpHash: this.auditService?.hashIdentifier(ip) ?? null,
          expiresAt,
        },
      });
    });

    const rawFrontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const frontendOrigin = rawFrontendUrl
      .split(',')[0]
      .trim()
      .replace(/\/+$/, '');
    const resetUrl = `${frontendOrigin}/reset-password?token=${rawToken}`;

    const emailDelivered = await this.sendPasswordResetEmail(
      user.email,
      user.username,
      resetUrl,
    );

    await this.auditService?.logEvent({
      actorId: user.id,
      eventType: 'AUTH_PASSWORD_RESET_REQUESTED',
      severity: 'INFO',
      ip,
      details: { emailDelivered },
    });

    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    if (nodeEnv !== 'production' && !emailDelivered) {
      this.logger.debug(
        `[DEV] Password reset link generated for ${user.username}: ${resetUrl}`,
      );
      return {
        message: genericMessage,
        devResetUrl: resetUrl,
      };
    }

    return { message: genericMessage };
  }

  async resetPassword(dto: ResetPasswordDto, ip?: string) {
    const tokenHash = this.hashToken(dto.token.trim());
    const now = new Date();

    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            isGuest: true,
            isBanned: true,
          },
        },
      },
    });

    if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt <= now) {
      throw new BadRequestException(
        'El enlace de recuperación es inválido o ha caducado. Solicita uno nuevo.',
      );
    }

    if (tokenRecord.user.isBanned) {
      throw new ForbiddenException('Cuenta suspendida por seguridad');
    }

    if (tokenRecord.user.isGuest) {
      throw new BadRequestException(
        'Las cuentas de invitado no admiten recuperación por correo',
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      this.BCRYPT_ROUNDS,
    );

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: tokenRecord.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimed.count !== 1) {
        throw new BadRequestException(
          'El enlace de recuperación ya fue utilizado o ha caducado.',
        );
      }

      await tx.passwordResetToken.updateMany({
        where: {
          userId: tokenRecord.userId,
          usedAt: null,
          id: { not: tokenRecord.id },
        },
        data: { usedAt: now },
      });

      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: {
          password: hashedPassword,
          lastPasswordChange: now,
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      await tx.refreshToken.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    await this.auditService?.logEvent({
      actorId: tokenRecord.userId,
      eventType: 'AUTH_PASSWORD_RESET_COMPLETED',
      severity: 'HIGH',
      ip,
    });

    return {
      message:
        'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva clave.',
    };
  }

  private async sendPasswordResetEmail(
    toEmail: string,
    username: string,
    resetUrl: string,
  ): Promise<boolean> {
    const resendApiKey = this.configService
      .get<string>('RESEND_API_KEY')
      ?.trim();
    if (!resendApiKey) {
      return false;
    }

    const fromAddress =
      this.configService.get<string>('EMAIL_FROM')?.trim() ||
      'VidaLoca MMORPG <no-reply@nexusaiholding.com>';

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [toEmail],
          subject: 'Recupera tu acceso a VidaLoca MMORPG (+18)',
          text: [
            `Hola ${username},`,
            '',
            'Hemos recibido una solicitud para restablecer tu contraseña en VidaLoca MMORPG (+18).',
            `Abre este enlace válido durante ${this.RESET_TOKEN_TTL_MINUTES} minutos:`,
            resetUrl,
            '',
            'Si no has solicitado este cambio, ignora este mensaje: tu cuenta sigue protegida.',
          ].join('\n'),
          html: `
            <div style="font-family:Arial,sans-serif;background:#09090b;color:#f4f4f5;padding:24px;border-radius:12px;">
              <h2 style="color:#f59e0b;margin:0 0 12px;">VidaLoca MMORPG (+18)</h2>
              <p>Hola <strong>${username}</strong>,</p>
              <p>Pulsa el botón para definir una nueva contraseña. El enlace caduca en ${this.RESET_TOKEN_TTL_MINUTES} minutos y solo puede usarse una vez:</p>
              <p style="margin:24px 0;">
                <a href="${resetUrl}" style="background:#f59e0b;color:#09090b;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">
                  Restablecer Contraseña
                </a>
              </p>
              <p style="font-size:12px;color:#a1a1aa;">Si no has solicitado este cambio, ignora este correo.</p>
            </div>
          `,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        this.logger.warn(
          `Resend API devolvió estado ${response.status} al enviar correo de recuperación`,
        );
        return false;
      }

      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Error enviando correo de recuperación: ${msg}`);
      return false;
    }
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
