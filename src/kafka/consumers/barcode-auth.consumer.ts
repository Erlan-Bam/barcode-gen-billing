// barcode-events.controller.ts
import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  KafkaContext,
  Payload,
} from '@nestjs/microservices';
import { LagoService } from 'src/shared/services/lago.service';
import { PrismaService } from 'src/shared/services/prisma.service';
import { User } from '../dto/user.dto';
import { randomUUID } from 'crypto';

@Controller()
export class BarcodeGenConsumer {
  private readonly logger = new Logger(BarcodeGenConsumer.name);
  constructor(
    private lago: LagoService,
    private prisma: PrismaService,
  ) {}

  @EventPattern('user.new')
  async createAccount(@Payload() data: User, @Ctx() context: KafkaContext) {
    let walletId: string | null = null;
    let customerId: string | null = null;
    try {
      const { key } = this.getMeta(context);
      const id = randomUUID();
      const wallet = await this.lago.createWallet(id);
      walletId = wallet.lago_id;
      const customer = await this.lago.createCustomer(id);
      customerId = customer.lago_id;

      await this.prisma.account.create({
        data: {
          id: id,
          userId: data.id,
          walletId: walletId!,
          lagoCustomerId: customerId!,
        },
      });

      this.logger.log(
        `Account created for userId=${data.id}, wallet=${walletId}, customer=${customerId}; key=${key}`,
      );
    } catch (error) {
      this.logger.error(
        `Error creating account for new user with id=${data.id}`,
      );
      if (walletId) {
        try {
          await this.lago.terminateWallet(walletId);
          this.logger.warn(`Rolled back Lago wallet ${walletId}`);
        } catch (error) {
          this.logger.error(`terminateWallet(${walletId}) failed: ${error}`);
        }
      }

      if (customerId) {
        try {
          await this.lago.deleteCustomer(customerId);
          this.logger.warn(`Rolled back Lago customer ${customerId}`);
        } catch (error) {
          this.logger.error(`deleteCustomer(${customerId}) failed: ${error}`);
        }
      }
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
