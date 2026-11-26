import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { createTourDto } from './dto/create-tour.dto.js';

@Injectable()
export class ToursService {
  constructor(private readonly prisma: PrismaService) {}

  async createTour(dto: createTourDto) {
    const validationErrors = validateSync(plainToInstance(createTourDto, dto), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (validationErrors.length > 0) {
      throw new BadRequestException('Invalid tour data.');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (endAt <= startAt) {
      throw new BadRequestException('The tour end time must be after the start time.');
    }

    const guide = await this.prisma.guide.findUnique({
      where: { publicReference: dto.guideReference },
    });

    if (!guide) {
      throw new NotFoundException('The assigned guide was not found.');
    }

    const tour = await this.prisma.tour.create({
      data: {
        name: dto.name,
        description: dto.description,
        meetingPoint: dto.meetingPoint,
        startAt,
        endAt,
        guideId: guide.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        meetingPoint: true,
        startAt: true,
        endAt: true,
        guide: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    return {
      status: 'ok',
      data: tour,
    };
  }

  async findTourById(tourId: string) {
    if (!tourId.trim()) {
      throw new BadRequestException('Tour identifier is required.');
    }

    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: {
        id: true,
        name: true,
        description: true,
        meetingPoint: true,
        startAt: true,
        endAt: true,
        guide: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!tour) {
      throw new NotFoundException('The tour was not found.');
    }

    return {
      status: 'ok',
      data: tour,
    };
  }

  async listTours() {
    const tours = await this.prisma.tour.findMany({
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        meetingPoint: true,
        startAt: true,
        endAt: true,
        guide: { select: { name: true, phone: true } },
      },
    });

    return { status: 'ok', data: tours };
  }
}
