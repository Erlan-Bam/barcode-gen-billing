// src/background/background-tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/shared/services/prisma.service';
import { LagoService } from 'src/shared/services/lago.service';
import { BillingProducer } from 'src/kafka/producers/billing.producer';
import { RedisService } from '../../shared/services/redis.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lago: LagoService,
    private readonly producer: BillingProducer,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async terminateExpiredSubscriptions() {
    try {
      const { count, list } = await this.lago.terminateExpiredSubscriptions();
      for (const subscription of list) {
        await this.producer.subscriptionTerminated(subscription);
      }
      this.logger.log(`Terminated ${count} expired subscriptions.`);
    } catch (error) {
      this.logger.error('Error terminating expired subscriptions', error);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async renewProducts() {
    try {
      const products = await this.prisma.product.findMany();
      for (let product of products) {
        await this.redis.set(`product:${product.id}`, product);
      }
    } catch (error) {
      this.logger.error('Error renewing products' + error);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async renewPlans() {
    try {
      const { plans } = await this.lago.getPlans();
      for (let plan of plans) {
        await this.redis.set(`lago:plan:${plan.code}`, plan);
      }
    } catch (error) {
      this.logger.error('Error renewing products' + error);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async renewCoupons() {
    try {
      const { coupons } = await this.lago.getCoupons();
      for (let coupon of coupons) {
        await this.redis.set(`lago:coupon:${coupon.code}`, coupon);
      }
    } catch (error) {
      this.logger.error('Error renewing products' + error);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async terminateExpiredCoupons() {
    try {
      const { count, list } = await this.lago.terminateExpiredCoupons();
      for (const coupon of list) {
        await this.producer.couponTerminated(coupon);
      }
      this.logger.log(`Terminated ${count} expired coupons.`);
    } catch (error) {
      this.logger.error('Error terminating expired coupons', error);
    }
  }
}
