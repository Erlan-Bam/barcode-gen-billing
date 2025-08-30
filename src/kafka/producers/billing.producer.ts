import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import {
  CouponObject,
  Subscription,
  SubscriptionObject,
  SubscriptionObjectExtended,
} from 'lago-javascript-client';
import { lastValueFrom } from 'rxjs';

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

    return await this.emit(this.topics.purchaseSuccess, null, data, {
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

    return await this.emit(this.topics.purchaseFailed, null, data, {
      eventType: this.topics.purchaseFailed,
      source: 'billing-service',
      timestamp: Date.now().toString(),
    });
  }
  async subscriptionTerminated(subscription: SubscriptionObject) {
    this.ensureReady();
    try {
      await this.emit(
        this.topics.subscriptionTerminated,
        subscription.lago_id,
        subscription,
        {
          eventType: this.topics.subscriptionTerminated,
          source: 'billing-service',
          timestamp: Date.now().toString(),
        },
      );
    } catch (error) {
      this.logger.error(
        `Emit failed for subscription terminated event ${error}`,
      );
    }
  }

  async couponTerminated(coupon: CouponObject) {
    this.ensureReady();
    try {
      await this.emit(this.topics.couponTerminated, coupon.lago_id, coupon, {
        eventType: this.topics.couponTerminated,
        source: 'billing-service',
        timestamp: Date.now().toString(),
      });
    } catch (error) {
      this.logger.error(`Emit failed for coupon terminated event ${error}`);
    }
  }

  async emit(
    topic: string,
    key: string = null,
    payload: any,
    headers: Record<string, string>,
  ) {
    this.ensureReady();
    try {
      await lastValueFrom(
        this.client.emit(topic, {
          key: key,
          value: JSON.stringify({ ...payload, transactionId: key }),
          headers: { ...headers, 'idempotency-key': key },
        }),
      );
      this.logger.debug(
        `Emitted event "${topic}" with payload=${JSON.stringify(payload)}`,
      );
    } catch (error) {
      this.logger.error(`Emit failed for topic="${topic}": ${error}`);
      throw error;
    }
  }
}
