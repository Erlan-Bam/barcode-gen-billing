import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { LagoService } from './services/lago.service';
import { CronService } from './services/cron.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtModule, JwtService } from '@nestjs/jwt';

@Module({
  imports: [JwtModule],
  providers: [PrismaService, LagoService, CronService, JwtStrategy, JwtService],
  exports: [PrismaService, LagoService, JwtStrategy, JwtService],
})
export class SharedModule {}
