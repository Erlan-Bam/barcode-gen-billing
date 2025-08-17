import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from 'src/shared/decorator/user.decorator';
import { BuyBarcodesDto } from './dto/buy-barcodes.dto';
import { BillingService } from './billing.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';

@Controller('billing')
@UseGuards(AuthGuard('jwt'))
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private billingService: BillingService) {}

  @Post('barcodes/buy')
  async buyBarcodes(@User('id') userId: string, @Body() data: BuyBarcodesDto) {
    try {
      data.userId = userId;
      const result = await this.billingService.buyBarcodes(data);
      this.logger.log(
        `buyBarcodes success for userId=${userId}, packageIndex=${data.index}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`buyBarcodes failed for userId=${userId}`, error);
      throw error;
    }
  }

  @Post('calculate-price')
  async calculatePrice(
    @Body() data: CalculatePriceDto,
    @User('id') userId: string,
  ) {
    data.userId = userId;
    try {
      const result = await this.billingService.calculatePrice(data);
      this.logger.log(`calculatePrice success`);
      return result;
    } catch (error) {
      this.logger.error(`calculatePrice failed`, error);
      throw error;
    }
  }

  @Post('check/coupon/:code')
  async checkCoupon(@Param('code') code: string) {
    try {
      const result = await this.billingService.checkCoupon(code);
      this.logger.log(`checkCoupon success for code=${code}`);
      return result;
    } catch (error) {
      this.logger.error(`checkCoupon failed for code=${code}`);
      throw error;
    }
  }

  @Get('check/credits')
  async checkAccount(@User('id') userId: string) {
    try {
      const result = await this.billingService.checkCredits(userId);
      this.logger.log(`checkCredits success for userId=${userId}`);
      return result;
    } catch (error) {
      this.logger.error(`checkCredits failed for userId=${userId}`, error);
      throw error;
    }
  }
}
