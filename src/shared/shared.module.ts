import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { KafkaService } from './services/kafka.service';

@Module({
  providers: [PrismaService, KafkaService],
  exports: [PrismaService, KafkaService],
})
export class SharedModule {}
