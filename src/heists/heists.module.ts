import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HeistsController } from './heists.controller';
import { HeistsService } from './heists.service';

@Module({
  imports: [PrismaModule],
  controllers: [HeistsController],
  providers: [HeistsService],
  exports: [HeistsService],
})
export class HeistsModule {}
