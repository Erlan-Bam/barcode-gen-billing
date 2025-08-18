// main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

export const clientId = process.env.KAFKA_CLIENT_ID;
export const brokers = process.env.KAFKA_BROKERS?.split(',');
export const groupId = process.env.KAFKA_GROUP_ID;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const kafkaEnabled = process.env.KAFKA_ENABLED === 'true';

  if (kafkaEnabled) {
    if (!clientId) logger.warn('KAFKA_CLIENT_ID not set');
    if (!brokers) logger.warn('KAFKA_BROKERS not set');
    if (!groupId) logger.warn('KAFKA_GROUP_ID not set');

    if (clientId && brokers && groupId) {
      app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId,
            brokers,
            connectionTimeout: 3000,
            requestTimeout: 5000,
            retry: {
              retries: 2,
              initialRetryTime: 300,
              factor: 2,
            },
          },
          consumer: { groupId },
          subscribe: { fromBeginning: false },
        },
      });

      try {
        await app.startAllMicroservices();
        logger.log('Kafka microservice started');
      } catch (error) {
        logger.error(`Kafka disabled (failed to start): ${error}`);
      }
    } else {
      logger.warn(
        'Kafka is enabled but required env vars are missing; skipping Kafka startup.',
      );
    }
  } else {
    logger.log('Kafka disabled via KAFKA_ENABLED !== "true"');
  }

  const port = Number(process.env.PORT ?? 6001);
  await app.listen(port);
  logger.log(`HTTP server listening on http://localhost:${port}`);
}

bootstrap();
