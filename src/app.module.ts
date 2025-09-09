import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SharedModule } from './shared/shared.module';
import { BillingModule } from './billing/billing.module';
import { ProductModule } from './product/product.module';
import { KafkaModule } from './kafka/kafka.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { BackgroundModule } from './background/background.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // окно 60 сек
        limit: 120, // 120 запросов/мин на IP
      },
    ]),
    SharedModule,
    BillingModule,
    ProductModule,
    KafkaModule,
    BackgroundModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
