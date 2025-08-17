import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './shared/services/prisma.service';
import { HealthService } from './kafka/services/health.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: HealthService,
  ) {}

  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ description: 'Service is alive' })
  @Get('/healthz')
  async liveness() {
    return { status: 'ok' };
  }

  @ApiOperation({ summary: 'Readiness probe' })
  @Get('/readyz')
  async readiness() {
    let db: 'ok' | 'error' = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }

    let lago: 'ok' | 'error' = 'ok';
    try {
    } catch {
      lago = 'error';
    }

    let kafka: 'ok' | 'error' = 'ok';
    try {
      await this.kafka.checkHealth();
    } catch {
      kafka = 'error';
    }

    const allOk = [db, kafka, lago].every((x) => x === 'ok');
    const status = allOk ? 'ready' : 'error';

    if (!allOk) {
      throw new HttpException(
        { status, database: db, kafka: kafka, lago: lago },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status, database: db, kafka };
  }
}
