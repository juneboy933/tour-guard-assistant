import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config';
import { GuidesModule } from './guides/guides.module.js';
import { ToursModule } from './tours/tours.module.js';
import { TouristsModule } from './tourists/tourists.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { AgentModule } from './agent/agent.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    PrismaModule,
    GuidesModule,
    ToursModule,
    TouristsModule,
    ReportsModule,
    AgentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
