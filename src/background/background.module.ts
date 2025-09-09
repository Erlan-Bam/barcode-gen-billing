import { Module } from '@nestjs/common';
import { KafkaModule } from 'src/kafka/kafka.module';

@Module({ imports: [KafkaModule] })
export class BackgroundModule {}
