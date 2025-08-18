import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { LagoService } from './services/lago.service';

@Module({
  providers: [PrismaService, LagoService],
  exports: [PrismaService, LagoService],
})
export class SharedModule {}
