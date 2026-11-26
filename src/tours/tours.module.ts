import { Module } from '@nestjs/common';
import { OperatorKeyGuard } from '../guides/operator-key.guard.js';
import { ToursController } from './tours.controller.js';
import { ToursService } from './tours.service.js';

@Module({
  controllers: [ToursController],
  providers: [ToursService, OperatorKeyGuard],
})
export class ToursModule {}
