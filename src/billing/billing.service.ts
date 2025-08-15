import { HttpException, Injectable, Logger } from '@nestjs/common';
import { LagoService } from 'src/shared/services/lago.service';
import { PrismaService } from 'src/shared/services/prisma.service';
import { BuyBarcodesDto, BuyType } from './dto/buy-barcodes.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  constructor(
    private prisma: PrismaService,
    private lago: LagoService,
  ) {}
  async buyBarcodes(data: BuyBarcodesDto) {
    try {
      const account = await this.prisma.account.findUnique({
        where: { userId: data.userId },
      });
      if (!account) {
        this.logger.debug(
          `Account for user with id: ${data.userId} was not found!`,
        );
        throw new HttpException('Account not found', 404);
      }
      if (data.type === BuyType.SINGLE) {
        await this.lago.addOns(data.code, account);
      } else if (data.type === BuyType.PACKAGE) {
        await this.lago.topUpWallet(data.credits, account);
      } else {
        await this.lago.subscriptionPlan(data.code, account);
      }
      return { message: 'Successfully initialized barcodes buy' };
    } catch (error) {
      if (error instanceof HttpException) return error;
      this.logger.error('Error occured in buy barcodes:', error);
      throw new HttpException('Something went wrong', 500);
    }
  }
}
