import { HttpException, Injectable, Logger } from '@nestjs/common';
import { Account } from '@prisma/client';
import {
  Client,
  CouponObject,
  getLagoError,
  SubscriptionObject,
} from 'lago-javascript-client';

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
        this.logger.error('Error occured in subscription plan', error);
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

  async getSubscription(account: Account) {
    try {
      const { data } = await this.lago.subscriptions.findSubscription(
        account.id,
      );
      return { subscription: data.subscription };
    } catch (error) {
      const lagoError =
        await getLagoError<typeof this.lago.subscriptions.findSubscription>(
          error,
        );
      if (lagoError?.error === 'Not Found') {
        throw new HttpException('Plan not found', 404);
      } else {
        this.logger.error('Error occured in get subscription', error);
        throw new HttpException('Bad request', 400);
      }
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

  async createWallet(accountId: string) {
    try {
      const { data } = await this.lago.wallets.createWallet({
        wallet: {
          external_customer_id: accountId,
          name: 'Prepaid',
          rate_amount: '1',
          currency: 'USD',
        },
      });
      return data.wallet;
    } catch (error) {
      this.logger.error(
        `Error occured in create wallet for accountId=${accountId}`,
        error,
      );
      throw new Error(
        `Error occured in create wallet for accountId=${accountId}`,
      );
    }
  }

  async createCustomer(accountId: string) {
    try {
      const { data } = await this.lago.customers.createCustomer({
        customer: {
          external_id: accountId,
        },
      });
      return data.customer;
    } catch (error) {
      throw new Error(
        `Error occured during customer creation for accountId=${accountId}`,
      );
    }
  }

  async terminateWallet(walletId: string) {
    try {
      const { data } = await this.lago.wallets.destroyWallet(walletId);
      return data.wallet;
    } catch (error) {
      this.logger.error(
        `Error occured in terminate wallet for walletId=${walletId}`,
        error,
      );
      throw new Error(
        `Error occured in terminate wallet for walletId=${walletId}`,
      );
    }
  }

  async deleteCustomer(customerId: string) {
    try {
      const { data } = await this.lago.customers.destroyCustomer(customerId);
      return data.customer;
    } catch (error) {
      this.logger.error(
        `Error occured in delete customer for customerId=${customerId}`,
        error,
      );
      throw new Error(
        `Error occured during customer creation for customerId=${customerId}`,
      );
    }
  }

  async terminateExpiredSubscriptions(): Promise<{
    count: number;
    list: SubscriptionObject[];
  }> {
    let page = 1;
    const per_page = 100;
    let count = 0,
      list: SubscriptionObject[] = [];
    const now = Date.now();

    while (true) {
      const { data } = await this.lago.subscriptions.findAllSubscriptions({
        page,
        per_page,
        'status[]': ['active', 'pending'],
      });

      const subs: SubscriptionObject[] = data.subscriptions ?? [];
      if (subs.length === 0) break;

      for (const sub of subs) {
        try {
          if (!sub.ending_at) continue;
          const endsAt = Date.parse(sub.ending_at);
          if (Number.isNaN(endsAt)) {
            this.logger.warn(
              `Subscription ${sub.external_id} has invalid ending_at=${sub.ending_at}`,
            );
            continue;
          }
          if (endsAt > now) continue;

          await this.lago.subscriptions.destroySubscription(sub.external_id, {
            on_termination_invoice: 'generate',
          });

          count++;
          list.push(sub);
          this.logger.log(
            `Terminated subscription external_id=${sub.external_id} (status=${sub.status}, ending_at=${sub.ending_at})`,
          );
        } catch (error) {
          const lagoError =
            await getLagoError<
              typeof this.lago.subscriptions.destroySubscription
            >(error);
          if (lagoError) {
            this.logger.error(
              `Failed terminating subscription external_id=${sub.external_id}: ${lagoError.error} (${lagoError.status})`,
            );
          } else {
            this.logger.error(
              `Unexpected error terminating subscription external_id=${sub.external_id}`,
              error,
            );
          }
        }
      }

      if (subs.length < per_page) break;
      page++;
    }

    return { count: count, list: list };
  }

  async terminateExpiredCoupons(): Promise<{
    count: number;
    list: CouponObject[];
  }> {
    let page = 1;
    const per_page = 100;
    let count = 0,
      list: CouponObject[] = [];

    while (true) {
      const { data } = await this.lago.coupons.findAllCoupons({
        page,
        per_page,
      });

      const coupons: CouponObject[] = data.coupons ?? [];
      if (coupons.length === 0) break;

      for (const coupon of coupons) {
        try {
          if (coupon.terminated_at) continue;

          const endsAt =
            coupon.expiration === 'time_limit' && coupon.expiration_at
              ? Date.parse(coupon.expiration_at)
              : undefined;

          if (endsAt !== undefined && Number.isNaN(endsAt)) {
            this.logger.warn(
              `Coupon ${coupon.code} has invalid expiration_at=${coupon.expiration_at}`,
            );
            continue;
          }

          if (!this.isExpired(coupon)) {
            continue;
          }

          await this.lago.coupons.destroyCoupon(coupon.code);

          count++;
          list.push(coupon);
          this.logger.log(
            `Terminated coupon code=${coupon.code} (name=${coupon.name ?? '—'}, expiration=${coupon.expiration}, expiration_at=${coupon.expiration_at ?? '—'})`,
          );
        } catch (error) {
          const lagoError =
            await getLagoError<typeof this.lago.coupons.destroyCoupon>(error);

          if (lagoError) {
            this.logger.error(
              `Failed terminating coupon code=${coupon.code}: ${lagoError.error} (${lagoError.status})`,
            );
          } else {
            this.logger.error(
              `Unexpected error terminating coupon code=${coupon.code}`,
              error,
            );
          }
        }
      }

      if (coupons.length < per_page) break;
      page++;
    }

    return { count, list };
  }
}
