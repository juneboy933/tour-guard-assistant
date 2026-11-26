import { Module } from '@nestjs/common';
import { OperatorKeyGuard } from '../guides/operator-key.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AfricasTalkingSmsService } from '../sms/africas-talking.sms.service.js';
import { SMS_SERVICE } from '../sms/sms.service.js';
import { InMemoryRateLimitGuard } from '../security/rate-limit.guard.js';
import { TouristsController } from './tourists.controller.js';
import { TouristsService } from './tourists.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [TouristsController],
  providers: [
    TouristsService,
    OperatorKeyGuard,
    {
      provide: SMS_SERVICE,
      useClass: AfricasTalkingSmsService,
    },
    InMemoryRateLimitGuard,
  ],
  exports: [TouristsService],
})
export class TouristsModule {}
