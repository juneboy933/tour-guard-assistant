import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OperatorKeyGuard } from '../guides/operator-key.guard.js';
import { createTourDto } from './dto/create-tour.dto.js';
import { ToursService } from './tours.service.js';

@Controller('tours')
@UseGuards(OperatorKeyGuard)
export class ToursController {
  constructor(private readonly toursService: ToursService) {}

  @Get()
  listTours() {
    return this.toursService.listTours();
  }

  @Post()
  createTour(@Body() dto: createTourDto) {
    return this.toursService.createTour(dto);
  }

  @Get(':id')
  findTourById(@Param('id') id: string) {
    return this.toursService.findTourById(id);
  }
}
