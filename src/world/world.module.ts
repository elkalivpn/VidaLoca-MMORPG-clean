import { Module } from '@nestjs/common';
import { WorldService } from './world.service';
import { WorldController } from './world.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [PrismaModule, EngagementModule],
  controllers: [WorldController],
  providers: [WorldService],
  exports: [WorldService],
})
export class WorldModule {}
