import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class createMissingReportDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  accessToken: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-f0-9]{32}$/)
  missingTouristReference: string;

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
