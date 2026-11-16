import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';
import { PromptInjectionInterceptor } from './security/prompt-injection.interceptor';
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
import { WorldModule } from './world/world.module';
import { FactionsModule } from './factions/factions.module';
import { HeistsModule } from './heists/heists.module';
import { EngagementModule } from './engagement/engagement.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { AdminModule } from './admin/admin.module';

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
    SecurityModule,
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
    WorldModule,
    FactionsModule,
    HeistsModule,
    EngagementModule,
    MarketplaceModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PromptInjectionInterceptor,
    },
  ],
})
export class AppModule {}
