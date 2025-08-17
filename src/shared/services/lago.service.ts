import { HttpException, Injectable, Logger } from '@nestjs/common';
import { Account } from '@prisma/client';
import { Client, CouponObject, getLagoError } from 'lago-javascript-client';

@Injectable()
export class LagoService {
  private readonly logger = new Logger(LagoService.name);
  private readonly lago: ReturnType<typeof Client>;

  constructor() {
    const LAGO_URL = process.env.LAGO_URL;
    const LAGO_API_KEY = process.env.LAGO_API_KEY;
    if (!LAGO_URL || !LAGO_API_KEY) {
      throw new Error('LAGO_URL or LAGO_API_KEY missing in .env');
    }

    this.lago = Client(LAGO_API_KEY, { baseUrl: LAGO_URL });
  }
  private isExpired(coupon: CouponObject): boolean {
    if (coupon.terminated_at) return true;

    if (coupon.expiration === 'time_limit' && coupon.expiration_at) {
      return new Date(coupon.expiration_at).getTime() <= Date.now();
    }
    return false;
  }

  async addOns(code: string, account: Account) {
    try {
      const { data } = await this.lago.invoices.createInvoice({
        invoice: {
          external_customer_id: account.id,
          fees: [
            {
              add_on_code: code,
              invoice_display_name: 'Buy one barcode',
            },
          ],
        },
      });
      return data.invoice;
    } catch (error) {
      const lagoError =
        await getLagoError<typeof this.lago.addOns.findAddOn>(error);
      if (lagoError?.error === 'Not Found') {
        throw new HttpException('Add ons not found', 404);
      } else {
        this.logger.error('Error occured in barcode add ons', error);
        throw new HttpException('Bad request', 400);
      }
    }
  }

  async topUpWallet(value: number, account: Account) {
    try {
      const { data } =
        await this.lago.walletTransactions.createWalletTransaction({
          wallet_transaction: {
            wallet_id: account.walletId,
            granted_credits: `${value}`,
          },
        });
      return data.wallet_transactions;
    } catch (error) {
      this.logger.error('Error occured in top up wallet', error);
      throw new HttpException('Bad request', 400);
    }
  }

  async subscriptionPlan(code: string, account: Account) {
    try {
      const { data } = await this.lago.subscriptions.createSubscription({
        subscription: {
          external_customer_id: account.id,
          plan_code: code,
          external_id: `${code}-${account.id}`,
          billing_time: 'calendar',
          ending_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      });
      return data.subscription;
    } catch (error) {
      const lagoError =
        await getLagoError<typeof this.lago.subscriptions.createSubscription>(
          error,
        );
      if (lagoError?.error === 'Not Found') {
        throw new HttpException('Plan not found', 404);
      } else {
        this.logger.error('Error occured in barcode add ons', error);
        throw new HttpException('Bad request', 400);
      }
    }
  }

  async getCredits(account: Account) {
    try {
      const { data } = await this.lago.wallets.findWallet(account.walletId);
      return { credits: data.wallet.credits_balance };
    } catch (error) {
      this.logger.error(
        `Error occured in get credits of walletId: ${account.walletId}`,
        error,
      );
      throw new HttpException('Bad request', 400);
    }
  }

  async checkCoupon(code: string) {
    try {
      const { data } = await this.lago.coupons.findCoupon(code);
      if (this.isExpired(data.coupon)) {
        throw new HttpException('This coupon is expired', 400);
      }
      return {
        coupon: {
          name: data.coupon.name,
          description: data.coupon.description,
          code: data.coupon.code,
          type: data.coupon.coupon_type,
          planCodes: data.coupon.plan_codes,
          amountCents: data.coupon.amount_cents,
          reusable: data.coupon.reusable,
          percentageRate: data.coupon.percentage_rate,
          frequency: data.coupon.frequency,
          frequencyDuration: data.coupon.frequency_duration,
          expirationAt: data.coupon.expiration_at,
        },
      };
    } catch (error) {
      const lagoError =
        await getLagoError<typeof this.lago.coupons.findCoupon>(error);
      if (lagoError?.error === 'Not Found') {
        throw new HttpException('Coupon not found', 404);
      }
      this.logger.error('Error occurred in check coupon', error);
      throw new HttpException('Bad request', 400);
    }
  }

  async checkPlan(code: string) {
    try {
      const { data } = await this.lago.plans.findPlan(code);
      return {
        plan: {
          name: data.plan.name,
          description: data.plan.description,
          code: data.plan.code,
          interval: data.plan.interval,
          payInAdvance: data.plan.pay_in_advance,
          amountCents: data.plan.amount_cents,
          amountCurrency: data.plan.amount_currency,
          trialPeriod: data.plan.trial_period,
          charges: data.plan.charges,
        },
      };
    } catch (error) {
      const lagoError =
        await getLagoError<typeof this.lago.plans.findPlan>(error);
      if (lagoError?.error === 'Not Found') {
        throw new HttpException('Coupon not found', 404);
      }
      this.logger.error('Error occurred in check plan', error);
      throw new HttpException('Bad request', 400);
    }
  }

  async spendBarcodeCredits(account: Account, credits: number) {
    try {
      const { data } =
        await this.lago.walletTransactions.createWalletTransaction({
          wallet_transaction: {
            wallet_id: account.walletId,
            voided_credits: `${credits}`,
          },
        });
      return data.wallet_transactions;
    } catch (error) {
      this.logger.error('Error occured in top up wallet', error);
      throw new HttpException('Bad request', 400);
    }
  }

  async payBarcodeCredits(account: Account, credits: number) {
    try {
      const { data } =
        await this.lago.walletTransactions.createWalletTransaction({
          wallet_transaction: {
            wallet_id: account.walletId,
            paid_credits: `${credits}`,
          },
        });
      return data.wallet_transactions;
    } catch (error) {
      this.logger.error('Error occured in top up wallet', error);
      throw new HttpException('Bad request', 400);
    }
  }

  async hasActiveSubscription(account: Account): Promise<boolean> {
    try {
      const { data } = await this.lago.subscriptions.findAllSubscriptions({
        external_customer_id: account.id,
      });
      return data.subscriptions ? true : false;
    } catch (error) {
      const lagoError =
        await getLagoError<typeof this.lago.subscriptions.findAllSubscriptions>(
          error,
        );

      if (lagoError?.status === 404 || lagoError?.error === 'Not Found')
        return false;

      this.logger.error('Error checking subscriptions', error);
      throw new HttpException('Bad request', 400);
    }
  }

  async checkHealth(): Promise<'ok' | 'error'> {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 3000);

    try {
      await this.lago.addOns.findAllAddOns(
        { per_page: 1, page: 1 },
        { signal: ac.signal },
      );

      return 'ok';
    } catch (error: any) {
      this.logger.error('Lago health check failed', error);
      return 'error';
    } finally {
      clearTimeout(timeout);
    }
  }
}
