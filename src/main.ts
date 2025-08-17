// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const kafkaEnabled = process.env.KAFKA_ENABLED === 'true';
  const clientId = process.env.KAFKA_CLIENT_ID;
  let brokers = process.env.KAFKA_BROKERS.split(',');
  const groupId = process.env.KAFKA_GROUP_ID;
  if (kafkaEnabled) {
    if (!clientId) {
      throw new Error('Missing required environment variable: KAFKA_CLIENT_ID');
    }
    if (!brokers) {
      throw new Error('Missing required environment variable: KAFKA_BROKERS');
    }
    if (!groupId) {
      throw new Error('Missing required environment variable: KAFKA_GROUP_ID');
    }
  }

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: { clientId: clientId, brokers: brokers },
      consumer: { groupId: groupId },
      subscribe: { fromBeginning: false },
    },
  });

  await app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();
