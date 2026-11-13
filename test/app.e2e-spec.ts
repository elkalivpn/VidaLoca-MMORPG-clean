import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'test-jwt-secret-for-e2e';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://vidaloca:vidaloca_dev@localhost:5432/vidaloca';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        stopAtFirstError: false,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns healthy status with mocked Prisma', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'healthy',
      service: 'VidaLoca MMORPG Backend',
      database: 'ok',
    });
  });

  it('GET /api/world/street requires JWT authentication', async () => {
    await request(app.getHttpServer()).get('/api/world/street').expect(401);
  });

  it('POST /api/auth/login validates DTO payload via ValidationPipe', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ unknownField: 'invalid' })
      .expect(400);
  });
});
