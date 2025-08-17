import { Module } from '@nestjs/common';
import { HealthService } from './services/health.service';
import { BarcodeGenController } from './consumers/barcode-gen.consumer';

@Module({
  controllers: [BarcodeGenController],
  providers: [HealthService],
  exports: [HealthService],
})
export class KafkaModule {}
