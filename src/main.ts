import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // WebSocket (Socket.IO) adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const frontendUrl = configService.get<string>(
    'FRONTEND_URL',
    'http://localhost:3001',
  );
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.enableCors({
    origin: isProduction
      ? [frontendUrl, 'https://vida-loca-mmorpg.vercel.app']
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VidaLoca MMORPG API')
    .setDescription(
      'API del MMORPG de mundo libre ambientado en España. Tú decides quién eres. Incluye WebSocket en /game.',
    )
    .setVersion('0.3.0')
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

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 VidaLoca MMORPG Backend → http://localhost:${port}`);
  logger.log(`📚 Swagger → http://localhost:${port}/api/docs`);
  logger.log(`🔌 WebSocket → ws://localhost:${port}/game`);
  logger.log(`🌍 CORS: ${isProduction ? frontendUrl : 'development (open)'}`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start VidaLoca backend:', err);
  process.exit(1);
});
