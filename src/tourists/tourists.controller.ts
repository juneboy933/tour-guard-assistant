import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { OperatorKeyGuard } from '../guides/operator-key.guard.js';
import { InMemoryRateLimitGuard } from '../security/rate-limit.guard.js';
import { addTouristDto } from './dto/add-tourist.dto.js';
import { TouristsService } from './tourists.service.js';

@Controller('tourists')
export class TouristsController {
  constructor(private readonly touristsService: TouristsService) {}

  @Get()
  @UseGuards(OperatorKeyGuard)
  listTourists() {
    return this.touristsService.listTourists();
  }

  @Post()
  @UseGuards(OperatorKeyGuard)
  addTourist(@Body() dto: addTouristDto) {
    return this.touristsService.addTourist(dto);
  }

  @Post(':publicReference/sms/retry')
  @UseGuards(OperatorKeyGuard)
  retryTouristSms(@Param('publicReference') publicReference: string) {
    return this.touristsService.retryTouristSms(publicReference);
  }

  @Get('context')
  @UseGuards(InMemoryRateLimitGuard)
  getTouristContext(@Headers('authorization') authorization?: string) {
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) {
      throw new UnauthorizedException('A bearer access token is required.');
    }

    return this.touristsService.getTouristContext(match[1]);
  }
}
