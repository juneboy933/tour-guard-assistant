import { Module } from '@nestjs/common';
import { GuidesService } from './guides.service.js';
import { GuidesController } from './guides.controller.js';
import { OperatorKeyGuard } from './operator-key.guard.js';

@Module({
  providers: [GuidesService, OperatorKeyGuard],
  controllers: [GuidesController]
})
export class GuidesModule {}
