import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from 'src/shared/decorator/user.decorator';
import { PrismaService } from 'src/shared/services/prisma.service';
import { BuyBarcodesDto } from './dto/buy-barcodes.dto';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(AuthGuard('jwt'))
export class BillingController {
  private readonly logger = new Logger(BillingController.name);
  constructor(private billingService: BillingService) {}

  @Post('barcodes/buy')
  async buyBarcodes(@User('id') userId: string, @Body() data: BuyBarcodesDto) {
    data.userId = userId;
    return this.billingService.buyBarcodes(data);
  }

  @Post('check')
  async checkAccount(@User('id') userId: string) {}
}
