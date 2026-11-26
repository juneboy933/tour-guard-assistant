import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { SMS_SERVICE } from '../sms/sms.service.js';
import type { SmsService } from '../sms/sms.service.js';
import { addTouristDto } from './dto/add-tourist.dto.js';

@Injectable()
export class TouristsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SERVICE) private readonly smsService: SmsService,
  ) {}

  async addTourist(dto: addTouristDto) {
    const validationErrors = validateSync(plainToInstance(addTouristDto, dto), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (validationErrors.length > 0) {
      throw new BadRequestException('Invalid tourist data.');
    }

    const assistantBaseUrl = process.env.TOURIST_ASSISTANT_BASE_URL?.replace(/\/$/, '');
    if (!assistantBaseUrl) {
      throw new InternalServerErrorException('Tourist assistant URL is not configured.');
    }

    const tour = await this.prisma.tour.findUnique({
      where: { id: dto.tourId },
      select: { id: true },
    });

    if (!tour) {
      throw new NotFoundException('The tour was not found.');
    }

    const existingTourist = await this.prisma.tourist.findFirst({
      where: {
        tourId: dto.tourId,
        phone: dto.phone,
      },
      select: { id: true },
    });

    if (existingTourist) {
      throw new BadRequestException('A tourist with that phone number is already on this tour.');
    }

    const rawToken = randomBytes(32).toString('hex');
    const accessToken = createHash('sha256').update(rawToken).digest('hex');
    const publicReference = randomBytes(16).toString('hex');

    let tourist;
    try {
      tourist = await this.prisma.tourist.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          tourId: dto.tourId,
          accessToken,
          publicReference,
          smsStatus: 'PENDING',
        },
        select: {
          id: true,
          name: true,
          phone: true,
          tourId: true,
          publicReference: true,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new BadRequestException('A tourist with that phone number is already on this tour.');
      }
      throw error;
    }

    const secureLink = `${assistantBaseUrl}/tourist/${rawToken}`;
    let smsStatus: 'SENT' | 'FAILED' = 'SENT';
    try {
      await this.smsService.sendSms(
        tourist.phone,
        `Your TourGuard assistant link: ${secureLink}`,
      );
      await this.prisma.tourist.update({
        where: { id: tourist.id },
        data: {
          smsStatus: 'SENT',
          smsSentAt: new Date(),
          smsFailureReason: null,
        },
      });
    } catch {
      smsStatus = 'FAILED';
      await this.prisma.tourist.update({
        where: { id: tourist.id },
        data: {
          smsStatus: 'FAILED',
          smsFailureReason: 'SMS delivery failed.',
        },
      });
    }

    return {
      status: 'ok',
      data: {
        name: tourist.name,
        phone: tourist.phone,
        publicReference: tourist.publicReference,
        secureLink,
        smsStatus,
      },
    };
  }

  async retryTouristSms(publicReference: string) {
    if (!/^[a-f0-9]{32}$/.test(publicReference)) {
      throw new BadRequestException('Tourist identifier is required.');
    }

    const assistantBaseUrl = process.env.TOURIST_ASSISTANT_BASE_URL?.replace(/\/$/, '');
    if (!assistantBaseUrl) {
      throw new InternalServerErrorException('Tourist assistant URL is not configured.');
    }

    const tourist = await this.prisma.tourist.findUnique({
      where: { publicReference },
      select: {
        id: true,
        publicReference: true,
        phone: true,
        smsStatus: true,
      },
    });

    if (!tourist) {
      throw new NotFoundException('The tourist was not found.');
    }

    if (tourist.smsStatus !== 'FAILED') {
      throw new ConflictException('SMS retry is only available for failed notifications.');
    }

    const rawToken = randomBytes(32).toString('hex');
    const accessToken = createHash('sha256').update(rawToken).digest('hex');
    const secureLink = `${assistantBaseUrl}/tourist/${rawToken}`;

    await this.prisma.tourist.update({
      where: { id: tourist.id },
      data: {
        accessToken,
        smsStatus: 'PENDING',
        smsFailureReason: null,
      },
    });

    let smsStatus: 'SENT' | 'FAILED' = 'SENT';
    try {
      await this.smsService.sendSms(
        tourist.phone,
        `Your TourGuard assistant link: ${secureLink}`,
      );
      await this.prisma.tourist.update({
        where: { id: tourist.id },
        data: {
          smsStatus: 'SENT',
          smsSentAt: new Date(),
          smsFailureReason: null,
        },
      });
    } catch {
      smsStatus = 'FAILED';
      await this.prisma.tourist.update({
        where: { id: tourist.id },
        data: {
          smsStatus: 'FAILED',
          smsFailureReason: 'SMS delivery failed.',
        },
      });
    }

    return {
      status: 'ok',
      data: {
        publicReference: tourist.publicReference,
        secureLink,
        smsStatus,
      },
    };
  }

  async getTouristContext(rawToken: string) {
    if (!rawToken.trim()) {
      throw new BadRequestException('Access token is required.');
    }

    const accessToken = createHash('sha256').update(rawToken).digest('hex');
    const touristIdentity = await this.prisma.tourist.findUnique({
      where: { accessToken },
      select: { id: true },
    });

    if (!touristIdentity) {
      throw new NotFoundException('Tourist context was not found.');
    }

    const tourist = await this.prisma.tourist.findUnique({
      where: { accessToken },
      select: {
        id: true,
        name: true,
        phone: true,
        publicReference: true,
        tour: {
          select: {
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
            tourists: {
              where: { id: { not: touristIdentity.id } },
              orderBy: { name: 'asc' },
              select: {
                name: true,
                publicReference: true,
              },
            },
          },
        },
      },
    });

    if (!tourist) {
      throw new NotFoundException('Tourist context was not found.');
    }

    return {
      status: 'ok',
      data: {
        name: tourist.name,
        phone: tourist.phone,
        publicReference: tourist.publicReference,
        tour: {
          name: tourist.tour.name,
          description: tourist.tour.description,
          meetingPoint: tourist.tour.meetingPoint,
          startAt: tourist.tour.startAt,
          endAt: tourist.tour.endAt,
          guide: tourist.tour.guide,
          tourists: tourist.tour.tourists,
        },
      },
    };
  }

  async listTourists() {
    const tourists = await this.prisma.tourist.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        phone: true,
        publicReference: true,
        smsStatus: true,
        tourId: true,
        tour: { select: { name: true } },
      },
    });

    return { status: 'ok', data: tourists };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error
      && error.code === 'P2002';
  }
}
