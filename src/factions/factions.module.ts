import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { FactionsController } from './factions.controller';
import { FactionsService } from './factions.service';

@Module({
  imports: [PrismaModule, RealtimeModule],
  controllers: [FactionsController],
  providers: [FactionsService],
  exports: [FactionsService],
})
export class FactionsModule {}
