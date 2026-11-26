import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { createLostReportDto } from './dto/create-lost-report.dto.js';
import { createMissingReportDto } from './dto/create-missing-report.dto.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLostReport(dto: createLostReportDto) {
    const validationErrors = validateSync(plainToInstance(createLostReportDto, dto), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (validationErrors.length > 0) {
      throw new BadRequestException('Invalid lost report data.');
    }

    const accessToken = createHash('sha256').update(dto.accessToken).digest('hex');
    const tourist = await this.prisma.tourist.findUnique({
      where: { accessToken },
      select: {
        id: true,
        tourId: true,
      },
    });

    if (!tourist) {
      throw new UnauthorizedException('The access token is not authorized.');
    }

    const report = await this.prisma.report.create({
      data: {
        publicReference: randomBytes(16).toString('hex'),
        type: 'LOST',
        status: 'OPEN',
        lat: dto.lat,
        lng: dto.lng,
        note: dto.note,
        reporterId: tourist.id,
        tourId: tourist.tourId,
      },
      select: {
        publicReference: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      status: 'ok',
      data: report,
    };
  }

  async createMissingReport(dto: createMissingReportDto) {
    const validationErrors = validateSync(plainToInstance(createMissingReportDto, dto), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (validationErrors.length > 0) {
      throw new BadRequestException('Invalid missing report data.');
    }

    const accessToken = createHash('sha256').update(dto.accessToken).digest('hex');
    const reporter = await this.prisma.tourist.findUnique({
      where: { accessToken },
      select: {
        id: true,
        tourId: true,
      },
    });

    if (!reporter) {
      throw new UnauthorizedException('The access token is not authorized.');
    }

    const missingTourist = await this.prisma.tourist.findUnique({
      where: { publicReference: dto.missingTouristReference },
      select: {
        id: true,
        tourId: true,
      },
    });

    if (!missingTourist || missingTourist.tourId !== reporter.tourId) {
      throw new BadRequestException('The missing tourist is not on your tour.');
    }

    const report = await this.prisma.report.create({
      data: {
        publicReference: randomBytes(16).toString('hex'),
        type: 'MISSING',
        status: 'OPEN',
        lat: dto.lat,
        lng: dto.lng,
        note: dto.note,
        reporterId: reporter.id,
        missingTouristId: missingTourist.id,
        tourId: reporter.tourId,
      },
      select: {
        publicReference: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      status: 'ok',
      data: report,
    };
  }

  async listReportsForTour(tourId: string) {
    if (!tourId.trim()) {
      throw new BadRequestException('Tour identifier is required.');
    }

    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { id: true },
    });

    if (!tour) {
      throw new NotFoundException('The tour was not found.');
    }

    const reports = await this.prisma.report.findMany({
      where: { tourId },
      orderBy: { createdAt: 'desc' },
      select: {
        publicReference: true,
        type: true,
        status: true,
        lat: true,
        lng: true,
        note: true,
        createdAt: true,
        reporter: {
          select: {
            name: true,
            phone: true,
          },
        },
        missingTourist: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    return {
      status: 'ok',
      data: reports,
    };
  }

  async acknowledgeReport(reportReference: string) {
    return this.transitionReport(reportReference, 'OPEN', 'ACKNOWLEDGED');
  }

  async resolveReport(reportReference: string) {
    return this.transitionReport(reportReference, 'ACKNOWLEDGED', 'RESOLVED');
  }

  async getReportStatus(rawToken: string, reportReference: string) {
    if (!rawToken.trim() || !/^[a-f0-9]{32}$/.test(reportReference)) {
      throw new BadRequestException('Access token and report identifier are required.');
    }

    const accessToken = createHash('sha256').update(rawToken).digest('hex');
    const report = await this.prisma.report.findFirst({
      where: {
        publicReference: reportReference,
        reporter: { accessToken },
      },
      select: {
        publicReference: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });

    if (!report) {
      throw new NotFoundException('The report was not found.');
    }

    return {
      status: 'ok',
      data: report,
    };
  }

  private async transitionReport(
    reportReference: string,
    expectedStatus: 'OPEN' | 'ACKNOWLEDGED',
    nextStatus: 'ACKNOWLEDGED' | 'RESOLVED',
  ) {
    if (!/^[a-f0-9]{32}$/.test(reportReference)) {
      throw new BadRequestException('Report identifier is required.');
    }

    const report = await this.prisma.report.findUnique({
      where: { publicReference: reportReference },
      select: { publicReference: true, status: true },
    });

    if (!report) {
      throw new NotFoundException('The report was not found.');
    }

    if (report.status !== expectedStatus) {
      throw new ConflictException('The report is not in a valid state for this transition.');
    }

    const updatedReport = await this.prisma.report.update({
      where: { publicReference: reportReference },
      data: { status: nextStatus },
      select: { publicReference: true, status: true },
    });

    return {
      status: 'ok',
      data: updatedReport,
    };
  }
}
