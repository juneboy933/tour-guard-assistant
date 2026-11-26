import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, validateSync } from 'class-validator';
import { TouristsService } from '../../tourists/tourists.service.js';

export class GetTouristContextInput {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  accessToken!: string;
}

export interface GetTouristContextOutput {
  tourist: {
    name: string;
    phone: string;
    publicReference: string;
  };
  tour: {
    name: string;
    description: string;
    meetingPoint: string;
    startAt: string;
    endAt: string;
    guide: {
      name: string;
      phone: string;
    };
  };
}

@Injectable()
export class GetTouristContextTool {
  constructor(private readonly touristsService: TouristsService) {}

  async execute(input: GetTouristContextInput): Promise<GetTouristContextOutput> {
    const validationErrors = validateSync(plainToInstance(GetTouristContextInput, input), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (validationErrors.length > 0) {
      throw new BadRequestException('Invalid tourist context input.');
    }

    const context = await this.touristsService.getTouristContext(input.accessToken);
    const tour = context.data.tour;

    return {
      tourist: {
        name: context.data.name,
        phone: context.data.phone,
        publicReference: context.data.publicReference,
      },
      tour: {
        name: tour.name,
        description: tour.description,
        meetingPoint: tour.meetingPoint,
        startAt: tour.startAt.toISOString(),
        endAt: tour.endAt.toISOString(),
        guide: {
          name: tour.guide.name,
          phone: tour.guide.phone,
        },
      },
    };
  }
}
