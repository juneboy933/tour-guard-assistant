import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { InMemoryRateLimitGuard } from '../security/rate-limit.guard.js';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService, InMemoryRateLimitGuard],
  exports: [ReportsService],
})
export class ReportsModule {}
