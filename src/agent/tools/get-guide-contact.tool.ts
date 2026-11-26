import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TouristsService } from '../../tourists/tourists.service.js';
import { GetTouristContextInput } from './get-tourist-context.tool.js';

export interface GetGuideContactOutput {
  guide: {
    name: string;
    phone: string;
  };
}

@Injectable()
export class GetGuideContactTool {
  constructor(private readonly touristsService: TouristsService) {}

  async execute(input: GetTouristContextInput): Promise<GetGuideContactOutput> {
    const validationErrors = validateSync(plainToInstance(GetTouristContextInput, input), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (validationErrors.length > 0) {
      throw new BadRequestException('Invalid guide contact input.');
    }

    const context = await this.touristsService.getTouristContext(input.accessToken);

    return {
      guide: {
        name: context.data.tour.guide.name,
        phone: context.data.tour.guide.phone,
      },
    };
  }
}
