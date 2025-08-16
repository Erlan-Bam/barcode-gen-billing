import { HttpException, Injectable, Logger } from '@nestjs/common';
import { Account } from '@prisma/client';
import { Client, getLagoError } from 'lago-javascript-client';

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
      if (lagoError.error === 'Not Found') {
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
      if (lagoError.error === 'Not Found') {
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
      this.logger.error('Error occured in top up wallet', error);
      throw new HttpException('Bad request', 400);
    }
  }
}
