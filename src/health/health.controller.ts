import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    let database = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'error';
    }

    if (database !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: database === 'ok' ? 'healthy' : 'degraded',
      service: 'VidaLoca MMORPG Backend',
      version: '0.1.0',
      database,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'VidaLoca MMORPG Backend',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    let database = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'error';
    }

    if (database !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: database === 'ok' ? 'ready' : 'not_ready',
      service: 'VidaLoca MMORPG Backend',
      database,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
