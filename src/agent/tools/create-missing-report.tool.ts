import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  validateSync,
} from 'class-validator';
import { ReportsService } from '../../reports/reports.service.js';

export class CreateMissingReportInput {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  accessToken!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-f0-9]{32}$/)
  missingTouristReference!: string;

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

export interface CreateMissingReportOutput {
  report: {
    reportReference: string;
    type: string;
    status: string;
    createdAt: string;
  };
}

@Injectable()
export class CreateMissingReportTool {
  constructor(private readonly reportsService: ReportsService) {}

  async execute(input: CreateMissingReportInput): Promise<CreateMissingReportOutput> {
    const validationErrors = validateSync(plainToInstance(CreateMissingReportInput, input), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (validationErrors.length > 0) {
      throw new BadRequestException('Invalid missing report input.');
    }

    const result = await this.reportsService.createMissingReport(input);

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
