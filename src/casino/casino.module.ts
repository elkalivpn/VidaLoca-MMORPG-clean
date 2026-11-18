import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CasinoController } from './casino.controller';
import { CasinoService } from './casino.service';

@Module({
  imports: [PrismaModule],
  controllers: [CasinoController],
  providers: [CasinoService],
  exports: [CasinoService],
})
export class CasinoModule {}
