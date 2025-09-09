// main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

export const clientId = process.env.KAFKA_CLIENT_ID;
export const brokers = process.env.KAFKA_BROKERS?.split(',');
export const groupId = process.env.KAFKA_GROUP_ID;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // для Swagger static
    }),
  );
  app.enableCors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Authorization'],
  });

  const NODE_ENV = process.env.NODE_ENV;
  if (NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Barcode API')
      .setDescription('Barcode endpoints')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
        },
        'JWT',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        operationsSorter: (a: any, b: any) => {
          // 1) Make order a Record<string,number> so indexing by any string is allowed
          const order: Record<string, number> = {
            post: 1,
            patch: 2,
            delete: 3,
            get: 4,
          };

          // 2) Cast a.get('method') to string, then lowercase
          const methodA = (a.get('method') as string).toLowerCase();
          const methodB = (b.get('method') as string).toLowerCase();

          // 3) Now safe to index
          const rankA = order[methodA] ?? 99;
          const rankB = order[methodB] ?? 99;

          if (rankA < rankB) return -1;
          if (rankA > rankB) return 1;
          // fallback to path compare
          const pathA = a.get('path') as string;
          const pathB = b.get('path') as string;
          return pathA.localeCompare(pathB);
        },
      },
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        logger.error(errors);
        return new BadRequestException(errors);
      },
    }),
  );

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
