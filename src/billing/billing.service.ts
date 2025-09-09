import { HttpException, Injectable, Logger } from '@nestjs/common';
import { LagoService } from 'src/shared/services/lago.service';
import { PrismaService } from 'src/shared/services/prisma.service';
import { BuyBarcodesDto, BuyType } from './dto/buy-barcodes.dto';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { Product } from '@prisma/client';
import { CouponObject, PlanObject } from 'lago-javascript-client';
import { BillingProducer } from 'src/kafka/producers/billing.producer';
import { RedisService } from 'src/shared/services/redis.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  constructor(
    private prisma: PrismaService,
    private lago: LagoService,
    private producer: BillingProducer,
    private redis: RedisService,
  ) {}
  async buyBarcodes(data: BuyBarcodesDto) {
    let credits = null,
      price = null,
      sub = null;
    try {
      const [account, product] = await this.prisma.$transaction([
        this.prisma.account.findUnique({
          where: { userId: data.userId },
        }),
        this.prisma.product.findFirst(),
      ]);
      if (!product) {
        this.logger.error(`Product with name barcode was not found`);
        throw new HttpException('Product not found', 500);
      }

      const { packages } = await this.prisma.getBarcodePackages();
      if (data.index < 0 || data.index >= packages.length) {
        throw new HttpException('Invalid package index is out of scope', 400);
      }

      if (!account) {
        this.logger.debug(
          `Account for user with id: ${data.userId} was not found!`,
        );
        throw new HttpException('Account not found', 404);
      }
      if (data.type === BuyType.SINGLE) {
        credits = packages[0].credits;
        price = packages[0].price;
        await this.lago.topUpWallet(credits, account);
        try {
          await this.producer.purchaseSuccess({
            userId: account.userId,
            credits: credits,
            price: price,
          });
        } catch (error) {
          this.logger.error(
            'Kafka emitting even purchaseSuccess failed for single',
            error,
          );
        }
      } else if (data.type === BuyType.PACKAGE) {
        credits = packages[data.index].credits;
        price = packages[data.index].price;
        await this.lago.topUpWallet(credits, account);
        try {
          await this.producer.purchaseSuccess({
            userId: account.userId,
            credits: credits,
            price: price,
          });
        } catch (error) {
          this.logger.error(
            'Kafka emitting even purchaseSuccess failed for package',
            error,
          );
        }
      } else {
        const subscription = await this.lago.subscriptionPlan(
          data.code,
          account,
        );
        sub = subscription;
        try {
          await this.producer.purchaseSuccess({
            userId: account.userId,
            credits: null,
            price: null,
            subscription: subscription,
          });
        } catch (error) {
          this.logger.error(
            'Kafka emitting even purchaseSuccess failed for subscription',
            error,
          );
        }
      }
      return { message: 'Successfully initialized barcodes buy' };
    } catch (error) {
      try {
        await this.producer.purchaseFailed({
          userId: data.userId,
          credits: credits,
          price: price,
          subscription: sub,
        });
      } finally {
        if (error instanceof HttpException) throw error;
        this.logger.error('Error occured in buy barcodes:', error);
        throw new HttpException('Something went wrong', 500);
      }
    }
  }

  async checkCredits(userId: string) {
    const account = await this.prisma.account.findUnique({
      where: { userId: userId },
    });
    if (!account) {
      this.logger.debug(`Account for user with id: ${userId} was not found!`);
      throw new HttpException('Account not found', 404);
    }
    return await this.lago.getCredits(account);
  }

  async checkSubscription(userId: string) {
    const account = await this.prisma.account.findUnique({
      where: { userId: userId },
    });
    if (!account) {
      this.logger.debug(`Account for user with id: ${userId} was not found!`);
      throw new HttpException('Account not found', 404);
    }
    return await this.lago.getSubscription(account);
  }

  async checkCoupon(code: string) {
    return await this.lago.checkCoupon(code);
  }

  async calculatePrice(data: CalculatePriceDto) {
    try {
      let product: Product;
      try {
        product = await this.redis.getProductById(data.productId);
      } catch {
        product = await this.prisma.product.findUnique({
          where: { id: data.productId },
        });
      }
      if (!product) {
        throw new HttpException('Product not found', 404);
      }
      let basePrice = 0;
      if (data.packageIndex) {
        const { packages } = await this.prisma.extractPackages(product);
        if (data.packageIndex < 0 || data.packageIndex >= packages.length) {
          throw new HttpException(
            'Invalid package packageIndex is out of scope',
            400,
          );
        }

        basePrice += packages[data.packageIndex].price;
      }
      let appliedPlan: Partial<PlanObject> = null;
      if (data.planCode) {
        let plan = null;
        try {
          plan = await this.redis.getPlanByCode(data.planCode);
        } catch {
          const { plan: lagoPlan } = await this.lago.checkPlan(data.planCode);
          plan = lagoPlan;
        }
        basePrice += plan.amountCents / 100;
        appliedPlan = plan;
      }

      let totalPrice = basePrice;
      let appliedCoupon: Partial<CouponObject> = null;
      if (data.couponCode) {
        let coupon = null;
        try {
          coupon = await this.redis.getCouponByCode(data.couponCode);
        } catch {
          const { coupon: lagoCoupon } = await this.lago.checkCoupon(
            data.couponCode,
          );
          coupon = lagoCoupon;
        }
        if (coupon.type === 'fixed_amount') {
          totalPrice = Math.max(0, basePrice - coupon.amountCents / 100);
        } else {
          totalPrice =
            basePrice * (1 - parseFloat(coupon.percentageRate) / 100);
        }
        appliedCoupon = coupon;
      }

      return {
        totalPrice: totalPrice,
        basePrice: basePrice,
        discount: {
          amount: appliedCoupon.amount_cents / 100 || null,
          rate: appliedCoupon.percentage_rate || null,
          description: appliedCoupon.description || null,
        },
        breakdown: [
          { product: product.name },
          {
            coupon: appliedCoupon.name,
            price: appliedCoupon.amount_cents / 100 || null,
            rate: appliedCoupon.percentage_rate,
          },
          {
            subscription: appliedPlan.name,
            price: appliedPlan.amount_cents / 100 || null,
          },
        ],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error occured in buy barcodes:', error);
      throw new HttpException('Something went wrong', 500);
    }
  }
}
