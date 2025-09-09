import { Global, Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { LagoService } from './services/lago.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { RedisService } from './services/redis.service';

@Global()
@Module({
  imports: [JwtModule],
  providers: [
    PrismaService,
    LagoService,
    JwtStrategy,
    JwtService,
    RedisService,
  ],
  exports: [PrismaService, LagoService, JwtStrategy, JwtService, RedisService],
})
export class SharedModule {}
