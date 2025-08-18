import { Module } from '@nestjs/common';
import { HealthService } from './services/health.service';
import { BarcodeGenController } from './consumers/barcode-gen.consumer';
import { SharedModule } from 'src/shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [BarcodeGenController],
  providers: [HealthService],
  exports: [HealthService],
})
export class KafkaModule {}
