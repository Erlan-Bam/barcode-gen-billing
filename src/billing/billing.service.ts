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
      const [account, product] = await this.prisma.$transaction([
        this.prisma.account.findUnique({
          where: { userId: data.userId },
        }),
        this.prisma.product.findFirst({
          where: {
            name: {
              contains: 'barcode',
              mode: 'insensitive',
            },
          },
        }),
      ]);
      type PackageItem = { credits: number; price: number };

      let packages: PackageItem[];
      try {
        const raw = product.packages;

        if (typeof raw === 'string') {
          packages = JSON.parse(raw) as PackageItem[];
        } else {
          packages = raw as unknown as PackageItem[];
        }
      } catch (error) {
        throw new HttpException(
          `Error parsing packages for product: ${product.name}`,
          500,
        );
      }
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
        await this.lago.topUpWallet(packages[0].credits, account);
      } else if (data.type === BuyType.PACKAGE) {
        await this.lago.topUpWallet(packages[data.index].credits, account);
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
}
