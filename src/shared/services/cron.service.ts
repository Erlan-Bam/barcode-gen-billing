// src/background/background-tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/shared/services/prisma.service';
import { LagoService } from 'src/shared/services/lago.service';
import { BillingProducer } from 'src/kafka/producers/billing.producer';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lago: LagoService,
    private readonly producer: BillingProducer,
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
