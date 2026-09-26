import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let database = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'error';
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
}
