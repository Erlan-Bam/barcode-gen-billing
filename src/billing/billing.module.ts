import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { SharedModule } from 'src/shared/shared.module';
import { KafkaModule } from 'src/kafka/kafka.module';

@Module({
  imports: [SharedModule, KafkaModule],
  providers: [BillingService],
  controllers: [BillingController],
})
export class BillingModule {}
