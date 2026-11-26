import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { OperatorKeyGuard } from '../guides/operator-key.guard.js';
import { InMemoryRateLimitGuard } from '../security/rate-limit.guard.js';
import { createLostReportDto } from './dto/create-lost-report.dto.js';
import { createMissingReportDto } from './dto/create-missing-report.dto.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('lost')
  @UseGuards(InMemoryRateLimitGuard)
  createLostReport(
    @Body() body: Omit<createLostReportDto, 'accessToken'>,
    @Headers('authorization') authorization?: string,
  ) {
    return this.reportsService.createLostReport({
      ...body,
      accessToken: this.extractBearerToken(authorization),
    });
  }

  @Post('missing')
  @UseGuards(InMemoryRateLimitGuard)
  createMissingReport(
    @Body() body: Omit<createMissingReportDto, 'accessToken'>,
    @Headers('authorization') authorization?: string,
  ) {
    return this.reportsService.createMissingReport({
      ...body,
      accessToken: this.extractBearerToken(authorization),
    });
  }

  @Get('status/:publicReference')
  @UseGuards(InMemoryRateLimitGuard)
  getReportStatus(
    @Param('publicReference') publicReference: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.reportsService.getReportStatus(
      this.extractBearerToken(authorization),
      publicReference,
    );
  }

  @Get('tour/:tourId')
  @UseGuards(OperatorKeyGuard)
  listReportsForTour(@Param('tourId') tourId: string) {
    return this.reportsService.listReportsForTour(tourId);
  }

  @Patch(':publicReference/acknowledge')
  @UseGuards(OperatorKeyGuard)
  acknowledgeReport(@Param('publicReference') publicReference: string) {
    return this.reportsService.acknowledgeReport(publicReference);
  }

  @Patch(':publicReference/resolve')
  @UseGuards(OperatorKeyGuard)
  resolveReport(@Param('publicReference') publicReference: string) {
    return this.reportsService.resolveReport(publicReference);
  }

  private extractBearerToken(authorization?: string): string {
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) {
      throw new UnauthorizedException('A bearer access token is required.');
    }

    return match[1];
  }
}
