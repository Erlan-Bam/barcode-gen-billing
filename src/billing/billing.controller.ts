import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from 'src/shared/decorator/user.decorator';
import { PrismaService } from 'src/shared/services/prisma.service';

@Controller('billing')
@UseGuards(AuthGuard('jwt'))
export class BillingController {
  constructor(private prisma: PrismaService) {}

  @Post('check')
  async checkAccount(@User('id') userId: string) {}
}
