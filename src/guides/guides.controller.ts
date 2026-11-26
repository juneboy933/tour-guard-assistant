import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GuidesService } from './guides.service.js';
import { createGuideDto } from './dto/create-guide.dto.js';
import { OperatorKeyGuard } from './operator-key.guard.js';

@Controller('guides')
@UseGuards(OperatorKeyGuard)
export class GuidesController {
    constructor(
        private readonly guideService: GuidesService,
    ) {}

    @Get(':phone')
    findGuideByPhone(@Param('phone') phone: string) {
        return this.guideService.findGuideByPhone(phone);
    }


  @Post()
  createGuide(@Body() dto: createGuideDto) {
    return this.guideService.createGuide(dto);
  }
}
