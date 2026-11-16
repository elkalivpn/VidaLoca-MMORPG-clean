import { Module } from '@nestjs/common';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [PrismaModule, EngagementModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
