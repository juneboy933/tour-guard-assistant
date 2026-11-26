import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { ToursService } from './tours.service.js';

describe('ToursService', () => {
  let service: ToursService;

  const prismaMock = {
    guide: {
      findUnique: vi.fn(),
    },
    tour: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToursService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ToursService>(ToursService);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTour', () => {
    const validDto = {
      name: 'Nairobi City Tour',
      description: 'A guided city tour.',
      meetingPoint: 'Kenya National Archives',
      startAt: '2026-12-01T08:00:00.000Z',
      endAt: '2026-12-01T12:00:00.000Z',
      guideReference: 'a'.repeat(32),
    };

    it('creates a tour for an existing guide', async () => {
      prismaMock.guide.findUnique.mockResolvedValue({
        id: 'guide-1',
        name: 'Demo Guide',
        phone: '+254712345678',
      });
      prismaMock.tour.create.mockResolvedValue({
        id: 'tour-1',
        name: validDto.name,
        description: validDto.description,
        meetingPoint: validDto.meetingPoint,
        startAt: new Date(validDto.startAt),
        endAt: new Date(validDto.endAt),
        guide: {
          name: 'Demo Guide',
          phone: '+254712345678',
        },
      });

      const result = await service.createTour(validDto);

      expect(result).toEqual({
        status: 'ok',
        data: {
          id: 'tour-1',
          name: 'Nairobi City Tour',
          description: 'A guided city tour.',
          meetingPoint: 'Kenya National Archives',
          startAt: new Date(validDto.startAt),
          endAt: new Date(validDto.endAt),
          guide: {
            name: 'Demo Guide',
            phone: '+254712345678',
          },
        },
      });

      expect(prismaMock.guide.findUnique).toHaveBeenCalledWith({
        where: { publicReference: 'a'.repeat(32) },
      });
      expect(prismaMock.tour.create).toHaveBeenCalledWith({
        data: {
          name: 'Nairobi City Tour',
          description: 'A guided city tour.',
          meetingPoint: 'Kenya National Archives',
          startAt: new Date(validDto.startAt),
          endAt: new Date(validDto.endAt),
          guideId: 'guide-1',
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
    });

    it.each([
      ['name', { ...validDto, name: '' }],
      ['description', { ...validDto, description: '   ' }],
      ['meeting point', { ...validDto, meetingPoint: '' }],
      ['start time', { ...validDto, startAt: 'not-a-date' }],
      ['end time', { ...validDto, endAt: 'not-a-date' }],
      ['guide', { ...validDto, guideReference: '' }],
      ['guide reference format', { ...validDto, guideReference: 'not-a-public-reference' }],
    ])('rejects an invalid %s', async (_field, dto) => {
      await expect(service.createTour(dto)).rejects.toThrow(BadRequestException);

      expect(prismaMock.guide.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.tour.create).not.toHaveBeenCalled();
    });

    it('rejects a tour whose end time is before its start time', async () => {
      await expect(
        service.createTour({
          ...validDto,
          endAt: '2026-12-01T07:59:59.000Z',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.guide.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.tour.create).not.toHaveBeenCalled();
    });

    it('rejects a tour whose end time equals its start time', async () => {
      await expect(
        service.createTour({
          ...validDto,
          endAt: validDto.startAt,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a tour when the guide does not exist', async () => {
      prismaMock.guide.findUnique.mockResolvedValue(null);

      await expect(service.createTour(validDto)).rejects.toThrow(NotFoundException);

      expect(prismaMock.tour.create).not.toHaveBeenCalled();
    });
  });

  describe('findTourById', () => {
    it('returns the tour and assigned guide details without tourists or reports', async () => {
      prismaMock.tour.findUnique.mockResolvedValue({
        id: 'tour-1',
        name: 'Nairobi City Tour',
        description: 'A guided city tour.',
        meetingPoint: 'Kenya National Archives',
        startAt: new Date('2026-12-01T08:00:00.000Z'),
        endAt: new Date('2026-12-01T12:00:00.000Z'),
        guide: {
          name: 'Demo Guide',
          phone: '+254712345678',
        },
      });

      const result = await service.findTourById('tour-1');

      expect(result).toEqual({
        status: 'ok',
        data: {
          id: 'tour-1',
          name: 'Nairobi City Tour',
          description: 'A guided city tour.',
          meetingPoint: 'Kenya National Archives',
          startAt: new Date('2026-12-01T08:00:00.000Z'),
          endAt: new Date('2026-12-01T12:00:00.000Z'),
          guide: {
            name: 'Demo Guide',
            phone: '+254712345678',
          },
        },
      });

      expect(prismaMock.tour.findUnique).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
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
    });

    it('rejects an empty tour identifier', async () => {
      await expect(service.findTourById('   ')).rejects.toThrow(BadRequestException);

      expect(prismaMock.tour.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the tour does not exist', async () => {
      prismaMock.tour.findUnique.mockResolvedValue(null);

      await expect(service.findTourById('tour-1')).rejects.toThrow(NotFoundException);
    });
  });
});
