import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, Min, MaxLength, validateSync } from 'class-validator';
import { ReportsService } from '../../reports/reports.service.js';

export class CreateLostReportInput {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  accessToken!: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(500)
  note?: string;
}

export interface CreateLostReportOutput {
  report: {
    reportReference: string;
    type: string;
    status: string;
    createdAt: string;
  };
}

@Injectable()
export class CreateLostReportTool {
  constructor(private readonly reportsService: ReportsService) {}

  async execute(input: CreateLostReportInput): Promise<CreateLostReportOutput> {
    const validationErrors = validateSync(plainToInstance(CreateLostReportInput, input), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (validationErrors.length > 0) {
      throw new BadRequestException('Invalid lost report input.');
    }

    const result = await this.reportsService.createLostReport(input);

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
