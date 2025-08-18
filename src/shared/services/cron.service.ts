// src/background/background-tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/shared/services/prisma.service';
import { LagoService } from 'src/shared/services/lago.service';
import { BillingProducer } from 'src/kafka/producers/billing.producer';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lago: LagoService,
    private readonly producer: BillingProducer,
  ) {}
}
