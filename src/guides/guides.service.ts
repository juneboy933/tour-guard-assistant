import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { createGuideDto } from './dto/create-guide.dto.js';

@Injectable()
export class GuidesService {
    constructor(private readonly prismaServices: PrismaService) {}

    async createGuide(dto: createGuideDto) {
        const validationErrors = validateSync(plainToInstance(createGuideDto, dto), {
            whitelist: true,
            forbidNonWhitelisted: true,
        });
        if (validationErrors.length > 0) {
            throw new BadRequestException('Invalid guide data.');
        }

        // Check if the guide already exists, with that phone number
        const existingGuide = await this.prismaServices.guide.findFirst({
            where: { phone: dto.phone},
        })

        if(existingGuide) throw new BadRequestException(
            `Guide with phone ${dto.phone} already exists.`
        )

        // If not, the create a new guide and return the new guide
        let newGuide;
        try {
            newGuide = await this.prismaServices.guide.create({
                data: {
                    name: dto.name,
                    phone: dto.phone,
                publicReference: randomBytes(16).toString('hex'),
                }
            });
        } catch (error) {
            if (this.isUniqueConstraintError(error)) {
                throw new BadRequestException('A guide with that phone number already exists.');
            }
            throw error;
        }

        return {
            status: 'ok',
            data: {
                name: newGuide.name,
                phone: newGuide.phone,
                publicReference: newGuide.publicReference,
            }
        }
    }

    async findGuideByPhone(phone: string) {
        if (!phone.trim()) {
        throw new BadRequestException('Phone number is required.');
    }

    const guide = await this.prismaServices.guide.findFirst({
        where: {
            phone,
        },
    });

    if (!guide) {
        throw new NotFoundException(
            `No guide found with phone ${phone}.`,
        );
    }

    return {
        name: guide.name,
        phone: guide.phone,
        publicReference: guide.publicReference,
    };
    }

    async listGuides() {
        const guides = await this.prismaServices.guide.findMany({
            orderBy: { name: 'asc' },
            select: { name: true, phone: true, publicReference: true },
        });

        return { status: 'ok', data: guides };
    }

    private isUniqueConstraintError(error: unknown): boolean {
        return typeof error === 'object' && error !== null && 'code' in error
            && error.code === 'P2002';
    }
}
