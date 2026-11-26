import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, validateSync } from 'class-validator';
import { ReportsService } from '../../reports/reports.service.js';

export class GetReportStatusInput {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  accessToken!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @Matches(/^[a-f0-9]{32}$/)
  reportReference!: string;
}

export interface GetReportStatusOutput {
  report: {
    reportReference: string;
    type: string;
    status: string;
    createdAt: string;
  };
}

@Injectable()
export class GetReportStatusTool {
  constructor(private readonly reportsService: ReportsService) {}

  async execute(input: GetReportStatusInput): Promise<GetReportStatusOutput> {
    const validationErrors = validateSync(plainToInstance(GetReportStatusInput, input), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (validationErrors.length > 0) {
      throw new BadRequestException('Invalid report status input.');
    }

    const result = await this.reportsService.getReportStatus(input.accessToken, input.reportReference);

    return {
      report: {
        reportReference: result.data.publicReference,
        type: result.data.type,
        status: result.data.status,
        createdAt: result.data.createdAt.toISOString(),
      },
    };
  }
}
