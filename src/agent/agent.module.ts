import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module.js';
import { TouristsModule } from '../tourists/tourists.module.js';
import { AgentToolsService } from './agent-tools.service.js';
import { AgentService } from './agent.service.js';
import { AgentController } from './agent.controller.js';
import { OllamaClient } from './ollama.client.js';
import { CreateLostReportTool } from './tools/create-lost-report.tool.js';
import { CreateMissingReportTool } from './tools/create-missing-report.tool.js';
import { GetGuideContactTool } from './tools/get-guide-contact.tool.js';
import { GetReportStatusTool } from './tools/get-report-status.tool.js';
import { GetTouristContextTool } from './tools/get-tourist-context.tool.js';
import { InMemoryRateLimitGuard } from '../security/rate-limit.guard.js';

@Module({
  imports: [TouristsModule, ReportsModule],
  controllers: [AgentController],
  providers: [
    AgentToolsService,
    AgentService,
    OllamaClient,
    GetTouristContextTool,
    GetGuideContactTool,
    CreateLostReportTool,
    CreateMissingReportTool,
    GetReportStatusTool,
    InMemoryRateLimitGuard,
  ],
  exports: [AgentToolsService],
})
export class AgentModule {}
