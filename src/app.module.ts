import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlayersModule } from './players/players.module';
import { EconomyModule } from './economy/economy.module';
import { InventoryModule } from './inventory/inventory.module';
import { ClansModule } from './clans/clans.module';
import { TransactionsModule } from './transactions/transactions.module';
import { HealthModule } from './health/health.module';
import { MissionsModule } from './missions/missions.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { PropertiesModule } from './properties/properties.module';
import { SkillsModule } from './skills/skills.module';
import { AchievementsModule } from './achievements/achievements.module';
import { BattlePassModule } from './battle-pass/battle-pass.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    PlayersModule,
    EconomyModule,
    InventoryModule,
    ClansModule,
    TransactionsModule,
    HealthModule,
    MissionsModule,
    VehiclesModule,
    PropertiesModule,
    SkillsModule,
    AchievementsModule,
    BattlePassModule,
    RealtimeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
