import { IsDateString, IsNotEmpty, IsString, Matches } from 'class-validator';

export class createTourDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  description: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  meetingPoint: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-f0-9]{32}$/)
  guideReference: string;
}
