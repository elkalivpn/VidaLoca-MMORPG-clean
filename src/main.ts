import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import express from 'express';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const isProductionEnv = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: isProductionEnv
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const allowedOriginsEnv = [
    configService.get<string>('FRONTEND_URL', ''),
    configService.get<string>('ALLOWED_ORIGINS', ''),
  ]
    .join(',')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const frontendOrigins = Array.from(
    new Set([
      ...allowedOriginsEnv,
      'https://vidaloca-mmorpg.vercel.app',
      'http://localhost:3001',
    ]),
  );
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  // Hardening: remove Express fingerprint & enforce strict security headers
  const expressApp = app.getHttpAdapter().getInstance() as express.Express;
  expressApp.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'", ...frontendOrigins, 'wss:', 'https:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // WebSocket (Socket.IO) adapter (Redis when REDIS_URL is configured, fallback in-memory)
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.enableCors({
    origin: isProduction
      ? (
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void,
        ) => {
          if (
            !origin ||
            frontendOrigins.includes(origin) ||
            /^https:\/\/vidaloca[a-z0-9-]*\.vercel\.app$/.test(origin) ||
            /^https:\/\/([a-z0-9-]+\.)?nexusaiholding\.com$/.test(origin)
          ) {
            callback(null, true);
          } else {
            callback(new Error('Origin not allowed by CORS'), false);
          }
        }
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.setGlobalPrefix('api');

  const enableSwagger =
    !isProduction || configService.get<string>('ENABLE_SWAGGER') === 'true';

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('VidaLoca MMORPG API')
      .setDescription(
        'API del MMORPG de mundo libre ambientado en España. Tú decides quién eres. Incluye WebSocket en /game.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('auth')
      .addTag('players')
      .addTag('missions')
      .addTag('vehicles')
      .addTag('properties')
      .addTag('skills')
      .addTag('achievements')
      .addTag('battle-pass')
      .addTag('clans')
      .addTag('realtime')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 VidaLoca MMORPG Backend → http://localhost:${port}`);
  if (enableSwagger) {
    logger.log(`📚 Swagger → http://localhost:${port}/api/docs`);
  } else {
    logger.log('📚 Swagger disabled in production');
  }
  logger.log(`🔌 WebSocket → ws://localhost:${port}/game`);
  logger.log(
    `🌍 CORS: ${isProduction ? frontendOrigins.join(', ') : 'development (open)'}`,
  );
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start VidaLoca backend:', err);
  process.exit(1);
});
