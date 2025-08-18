import { Module } from '@nestjs/common';
import { HealthService } from './services/health.service';
import { BarcodeGenConsumer } from './consumers/barcode-gen.consumer';
import { SharedModule } from 'src/shared/shared.module';
import { BillingProducer } from './producers/billing.producer';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { brokers, clientId } from 'src/main';

@Module({
  imports: [
    SharedModule,
    ClientsModule.register([
      {
        name: 'KAFKA_BILLING',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId,
            brokers,
            connectionTimeout: 3000,
            requestTimeout: 5000,
            retry: { retries: 2, initialRetryTime: 300, factor: 2 },
          },
          producer: {
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
  ],
  controllers: [BarcodeGenConsumer],
  providers: [HealthService, BillingProducer],
  exports: [HealthService, BillingProducer],
})
export class KafkaModule {}
