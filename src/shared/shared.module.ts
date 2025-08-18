import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { LagoService } from './services/lago.service';
import { CronService } from './services/cron.service';

@Module({
  providers: [PrismaService, LagoService, CronService],
  exports: [PrismaService, LagoService],
})
export class SharedModule {}
