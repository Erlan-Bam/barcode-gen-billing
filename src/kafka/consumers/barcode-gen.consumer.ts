// barcode-events.controller.ts
import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  KafkaContext,
  Payload,
} from '@nestjs/microservices';
import { Barcode } from '../dto/barcode.dto';
import { LagoService } from 'src/shared/services/lago.service';
import { PrismaService } from 'src/shared/services/prisma.service';

@Controller()
export class BarcodeGenConsumer {
  private readonly logger = new Logger(BarcodeGenConsumer.name);
  constructor(
    private lago: LagoService,
    private prisma: PrismaService,
  ) {}

  @EventPattern('barcode.new')
  async handleGenerated(
    @Payload() data: Barcode,
    @Ctx() context: KafkaContext,
  ) {
    try {
      const { key, headers } = this.getMeta(context);
      const account = await this.prisma.account.findUnique({
        where: { userId: data.userId },
      });
      const { packages, product } = await this.prisma.getBarcodePackages();
      if (packages.length === 0) {
        this.logger.error(`Package is empty for product=${product.name}`);
      }

      const isSubscribed = await this.lago.hasActiveSubscription(account);
      if (isSubscribed) {
        return;
      }
      const { credits } = await this.lago.getCredits(account);
      if (parseInt(credits) > 0) {
        await this.lago.spendBarcodeCredits(account, packages[0].credits);
      } else {
        await this.lago.payBarcodeCredits(account, packages[0].credits);
      }

      this.logger.log(
        `[barcode.new] key=${key} id=${data?.id} headers=${JSON.stringify(headers)}`,
      );
    } catch (error) {
      this.logger.error(`[barcode.new] id=${data?.id} error=${error}`);
    }
  }

  @EventPattern('barcode.edit')
  async handleEdited(@Payload() data: Barcode, @Ctx() context: KafkaContext) {
    try {
      const { key, headers } = this.getMeta(context);

      const account = await this.prisma.account.findUnique({
        where: { userId: data.userId },
      });

      if (!account) {
        this.logger.warn(`[barcode.edit] No account for userId=${data.userId}`);
        return;
      }

      const isSubscribed = await this.lago.hasActiveSubscription(account);
      if (isSubscribed) {
        return;
      } else {
        this.logger.warn(
          `[barcode.edit] User is not subscribed userId=${data.userId}`,
        );
      }

      this.logger.log(
        `[barcode.edit] key=${key} id=${data?.id} headers=${JSON.stringify(headers)}`,
      );
    } catch (error) {
      this.logger.error(`[barcode.edit] id=${data?.id} error=${error}`);
    }
  }

  private getMeta(context: KafkaContext) {
    const message = context.getMessage();
    const key = message.key?.toString();
    const headers = Object.fromEntries(
      Object.entries(message.headers ?? {}).map(([k, v]) => [k, v?.toString()]),
    );
    return { key, headers };
  }
}
