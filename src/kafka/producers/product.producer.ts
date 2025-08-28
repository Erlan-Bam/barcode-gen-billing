import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Product } from '@prisma/client';

@Injectable()
export class ProductProducer implements OnModuleInit {
  private readonly logger = new Logger(ProductProducer.name);
  private readonly enabled = process.env.KAFKA_ENABLED === 'true';
  private connected = false;

  private topics = {
    productUpdated: 'billing.product.updated',
  };

  constructor(@Inject('KAFKA_BILLING') private readonly client: ClientKafka) {}

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Kafka producer disabled via KAFKA_ENABLED !== "true"');
      return;
    }
    try {
      await this.client.connect();
      this.connected = true;
      this.logger.log('Kafka billing producer connected');
    } catch (error: any) {
      this.connected = false;
      this.logger.error(
        `Kafka producer connect failed: ${error?.message ?? error}`,
      );
    }
  }
  private ensureReady() {
    if (!this.client || !this.connected) {
      throw new Error('Kafka is not ready');
    }
  }

  async productUpdated(product: Product) {
    this.ensureReady();
    try {
      await this.emit(this.topics.productUpdated, product, {
        eventType: this.topics.productUpdated,
        source: 'billing-service',
        timestamp: Date.now().toString(),
      });
    } catch (error) {
      this.logger.error(`Emit failed for product updated event ${error}`);
    }
  }

  async emit(topic: string, payload: unknown, headers: Record<string, string>) {
    this.ensureReady();
    try {
      this.client.emit(topic, { value: JSON.stringify(payload), headers });
      this.logger.debug(
        `Emitted event "${topic}" with payload=${JSON.stringify(payload)}`,
      );
    } catch (error) {
      this.logger.error(`Emit failed for topic="${topic}": ${error}`);
      throw error;
    }
  }
}
