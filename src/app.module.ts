import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SharedModule } from './shared/shared.module';
import { BillingModule } from './billing/billing.module';
import { AdminModule } from './admin/admin.module';
import { ProductModule } from './product/product.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [SharedModule, BillingModule, AdminModule, ProductModule, KafkaModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
