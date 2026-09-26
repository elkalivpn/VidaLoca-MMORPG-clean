import { Module } from '@nestjs/common';
import { BattlePassController } from './battle-pass.controller';
import { BattlePassService } from './battle-pass.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BattlePassController],
  providers: [BattlePassService],
  exports: [BattlePassService],
})
export class BattlePassModule {}
