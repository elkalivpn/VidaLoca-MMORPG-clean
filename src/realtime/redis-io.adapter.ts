import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  constructor(
    appOrHttpServer: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(appOrHttpServer);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL')?.trim();
    if (!redisUrl) {
      this.logger.log(
        'REDIS_URL not set — using default in-memory Socket.IO adapter',
      );
      return;
    }

    const pubClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy: () => null,
    });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
      this.logger.warn(`Redis pubClient error: ${err.message}`);
    });
    subClient.on('error', (err) => {
      this.logger.warn(`Redis subClient error: ${err.message}`);
    });

    try {
      await Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Redis connection timeout (3000ms)')),
            3000,
          ),
        ),
      ]);

      this.pubClient = pubClient;
      this.subClient = subClient;
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Socket.IO Redis adapter connected');
    } catch (err: any) {
      this.logger.warn(
        `Failed to connect Socket.IO Redis adapter (${err?.message ?? err}) — falling back to in-memory adapter`,
      );
      await Promise.allSettled([
        pubClient.quit().catch(() => pubClient.disconnect()),
        subClient.quit().catch(() => subClient.disconnect()),
      ]);
      this.pubClient = null;
      this.subClient = null;
      this.adapterConstructor = null;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const allowedOrigins = [
      this.configService.get<string>('FRONTEND_URL', ''),
      this.configService.get<string>('ALLOWED_ORIGINS', ''),
      'https://vidaloca-mmorpg.vercel.app',
      'http://localhost:3001',
    ]
      .join(',')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const corsOrigin = isProduction
      ? (
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void,
        ) => {
          if (
            !origin ||
            allowedOrigins.includes(origin) ||
            /^https:\/\/vidaloca[a-z0-9-]*\.vercel\.app$/.test(origin)
          ) {
            callback(null, true);
          } else {
            callback(new Error('Origin not allowed by WebSocket CORS policy'), false);
          }
        }
      : true;

    const mergedOptions: ServerOptions = {
      ...(options ?? ({} as ServerOptions)),
      cors: {
        ...(typeof options?.cors === 'object' ? options.cors : {}),
        origin: corsOrigin,
        credentials: true,
      },
    };

    const server = super.createIOServer(port, mergedOptions);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  async close(): Promise<void> {
    await Promise.allSettled([
      this.pubClient?.quit().catch(() => this.pubClient?.disconnect()),
      this.subClient?.quit().catch(() => this.subClient?.disconnect()),
    ]);
    this.pubClient = null;
    this.subClient = null;
    this.adapterConstructor = null;
  }
}
