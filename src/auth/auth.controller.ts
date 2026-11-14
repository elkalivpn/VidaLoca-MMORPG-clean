import { Controller, Post, Body, UseGuards, Req, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    return this.authService.register(registerDto, req.ip);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(loginDto, req.ip);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(
    @Req() req: Request & { user: { id: string } },
    @Body('refreshToken') refreshToken?: string,
  ) {
    return this.authService.logout(req.user.id, refreshToken, req.ip);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async refreshTokens(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
  ) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken, req.ip);
  }
}
