import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

interface JwtPayload {
  sub: string;
  tokenType?: string;
  tv?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const secret = configService.getOrThrow<string>('JWT_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload?.tokenType && payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.authService.validateUser(
      payload.sub,
      typeof payload.tv === 'number' ? payload.tv : undefined,
    );
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
