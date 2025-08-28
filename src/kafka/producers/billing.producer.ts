// src/kafka/producers/billing.producer.ts
import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Barcode } from '../dto/barcode.dto';
import {
  CouponObject,
  Subscription,
  SubscriptionObject,
  SubscriptionObjectExtended,
} from 'lago-javascript-client';

@Injectable()
export class BillingProducer implements OnModuleInit {
  private readonly logger = new Logger(BillingProducer.name);
  private readonly enabled = process.env.KAFKA_ENABLED === 'true';
  private connected = false;

  private topics = {
    purchaseSuccess: 'billing.purchase.success',
    purchaseFailed: 'billing.purchase.failed',
    subscriptionTerminated: 'billing.subscription.terminated',
    couponTerminated: 'billing.coupon.terminated',
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

  async purchaseSuccess(data: {
    userId: string;
    credits: number | null;
    price: number | null;
    subscription?: SubscriptionObjectExtended;
  }) {
    this.ensureReady();

    return await this.emit(this.topics.purchaseSuccess, data, {
      eventType: this.topics.purchaseSuccess,
      source: 'billing-service',
      timestamp: Date.now().toString(),
    });
  }

  async purchaseFailed(data: {
    userId: string;
    credits: number | null;
    price: number | null;
    subscription?: Subscription;
  }) {
    this.ensureReady();

    return await this.emit(this.topics.purchaseFailed, data, {
      eventType: this.topics.purchaseFailed,
      source: 'billing-service',
      timestamp: Date.now().toString(),
    });
  }
  async subscriptionTerminated(subscription: SubscriptionObject) {
    this.ensureReady();
    try {
      await this.emit(this.topics.subscriptionTerminated, subscription, {
        eventType: this.topics.subscriptionTerminated,
        source: 'billing-service',
        timestamp: Date.now().toString(),
      });
    } catch (error) {
      this.logger.error(
        `Emit failed for subscription terminated event ${error}`,
      );
    }
  }

  async couponTerminated(coupon: CouponObject) {
    this.ensureReady();
    try {
      await this.emit(this.topics.couponTerminated, coupon, {
        eventType: this.topics.couponTerminated,
        source: 'billing-service',
        timestamp: Date.now().toString(),
      });
    } catch (error) {
      this.logger.error(`Emit failed for coupon terminated event ${error}`);
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
