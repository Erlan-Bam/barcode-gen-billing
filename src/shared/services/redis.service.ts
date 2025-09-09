import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis, { Redis as RedisClient } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClient;
  private readonly logger = new Logger(RedisService.name);

  async onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        if (times >= 10) {
          return null;
        }
        return Math.min(times * 50, 1000);
      },
    });

    this.client.on('connect', () => {
      this.logger.log('[Redis] Connected');
    });

    this.client.on('error', (err) => {
      this.logger.error('[Redis] Error', err);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async getProductById(id: string) {
    const data = await this.client.get(`product:${id}`);
    if (!data) {
      throw new Error('No product found');
    }
    return JSON.parse(data);
  }

  async getPlanByCode(code: string) {
    const data = await this.client.get(`lago:plan:${code}`);
    if (!data) {
      throw new Error('No plan found');
    }
    return JSON.parse(data);
  }

  async getCouponByCode(code: string) {
    const data = await this.client.get(`lago:coupon:${code}`);
    if (!data) {
      throw new Error('No coupon found');
    }
    return JSON.parse(data);
  }

  async set(
    key: string,
    value: Record<string, any>,
    ttlSeconds?: number,
  ): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } else {
      await this.client.set(key, JSON.stringify(value));
    }
  }
}
