import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportsService } from './reports.service.js';

describe('ReportsService', () => {
  let service: ReportsService;

  const prismaMock = {
    tour: {
      findUnique: vi.fn(),
    },
    tourist: {
      findUnique: vi.fn(),
    },
    report: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLostReport', () => {
    const validInput = {
      accessToken: 'a'.repeat(64),
      lat: -1.286389,
      lng: 36.817223,
      note: 'I am near the main entrance.',
    };

    it('creates an OPEN LOST report for the authenticated tourist', async () => {
      prismaMock.tourist.findUnique.mockResolvedValue({
        id: 'tourist-1',
        tourId: 'tour-1',
      });
      prismaMock.report.create.mockResolvedValue({
        publicReference: 'r'.repeat(32),
        type: 'LOST',
        status: 'OPEN',
        createdAt: new Date('2026-12-01T09:00:00.000Z'),
      });

      const result = await service.createLostReport(validInput);

      expect(result).toEqual({
        status: 'ok',
        data: {
          publicReference: 'r'.repeat(32),
          type: 'LOST',
          status: 'OPEN',
          createdAt: new Date('2026-12-01T09:00:00.000Z'),
        },
      });

      expect(prismaMock.report.create).toHaveBeenCalledWith({
        data: {
          publicReference: expect.stringMatching(/^[a-f0-9]{32}$/),
          type: 'LOST',
          status: 'OPEN',
          lat: -1.286389,
          lng: 36.817223,
          note: 'I am near the main entrance.',
          reporterId: 'tourist-1',
          tourId: 'tour-1',
        },
        select: {
          publicReference: true,
          type: true,
          status: true,
          createdAt: true,
        },
      });
    });

    it('rejects an unknown access token', async () => {
      prismaMock.tourist.findUnique.mockResolvedValue(null);

      await expect(service.createLostReport(validInput)).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.report.create).not.toHaveBeenCalled();
    });

    it.each([
      ['latitude', { ...validInput, lat: 91 }],
      ['longitude', { ...validInput, lng: 181 }],
      ['note', { ...validInput, note: ' ' }],
    ])('rejects invalid %s input', async (_field, input) => {
      await expect(service.createLostReport(input)).rejects.toThrow(BadRequestException);

      expect(prismaMock.tourist.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.report.create).not.toHaveBeenCalled();
    });
  });

  describe('createMissingReport', () => {
    const validInput = {
      accessToken: 'a'.repeat(64),
      missingTouristReference: 'c'.repeat(32),
      lat: -1.286389,
      lng: 36.817223,
      note: 'I last saw them near the entrance.',
    };

    it('creates an OPEN MISSING report for a tourist on the same tour', async () => {
      prismaMock.tourist.findUnique
        .mockResolvedValueOnce({ id: 'tourist-1', tourId: 'tour-1' })
        .mockResolvedValueOnce({ id: 'tourist-2', tourId: 'tour-1' });
      prismaMock.report.create.mockResolvedValue({
        publicReference: 's'.repeat(32),
        type: 'MISSING',
        status: 'OPEN',
        createdAt: new Date('2026-12-01T09:05:00.000Z'),
      });

      const result = await service.createMissingReport(validInput);

      expect(result).toEqual({
        status: 'ok',
        data: {
          publicReference: 's'.repeat(32),
          type: 'MISSING',
          status: 'OPEN',
          createdAt: new Date('2026-12-01T09:05:00.000Z'),
        },
      });

      expect(prismaMock.tourist.findUnique).toHaveBeenNthCalledWith(2, {
        where: { publicReference: 'c'.repeat(32) },
        select: { id: true, tourId: true },
      });
      expect(prismaMock.report.create).toHaveBeenCalledWith({
        data: {
          publicReference: expect.stringMatching(/^[a-f0-9]{32}$/),
          type: 'MISSING',
          status: 'OPEN',
          lat: -1.286389,
          lng: 36.817223,
          note: 'I last saw them near the entrance.',
          reporterId: 'tourist-1',
          missingTouristId: 'tourist-2',
          tourId: 'tour-1',
        },
        select: {
          publicReference: true,
          type: true,
          status: true,
          createdAt: true,
        },
      });
    });

    it('rejects a missing tourist reference from another tour', async () => {
      prismaMock.tourist.findUnique
        .mockResolvedValueOnce({ id: 'tourist-1', tourId: 'tour-1' })
        .mockResolvedValueOnce({ id: 'tourist-2', tourId: 'tour-2' });

      await expect(service.createMissingReport(validInput)).rejects.toThrow(BadRequestException);
      expect(prismaMock.report.create).not.toHaveBeenCalled();
    });

    it('rejects a malformed missing tourist reference before querying', async () => {
      await expect(service.createMissingReport({
        ...validInput,
        missingTouristReference: 'not-a-public-reference',
      })).rejects.toThrow(BadRequestException);

      expect(prismaMock.tourist.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an unknown missing tourist reference', async () => {
      prismaMock.tourist.findUnique
        .mockResolvedValueOnce({ id: 'tourist-1', tourId: 'tour-1' })
        .mockResolvedValueOnce(null);

      await expect(service.createMissingReport(validInput)).rejects.toThrow(BadRequestException);
      expect(prismaMock.report.create).not.toHaveBeenCalled();
    });
  });

  describe('listReportsForTour', () => {
    it('returns a compact newest-first report list for an existing tour', async () => {
      prismaMock.tour.findUnique.mockResolvedValue({ id: 'tour-1' });
      prismaMock.report.findMany = vi.fn().mockResolvedValue([
        {
          publicReference: 's'.repeat(32),
          type: 'MISSING',
          status: 'OPEN',
          lat: -1.28,
          lng: 36.81,
          note: 'Near the entrance.',
          createdAt: new Date('2026-12-01T09:05:00.000Z'),
          reporter: { name: 'Reporter', phone: '+254700000001' },
          missingTourist: { name: 'Missing Tourist', phone: '+254700000002' },
        },
      ]);

      const result = await service.listReportsForTour('tour-1');

      expect(result).toEqual({
        status: 'ok',
        data: [
          {
            publicReference: 's'.repeat(32),
            type: 'MISSING',
            status: 'OPEN',
            lat: -1.28,
            lng: 36.81,
            note: 'Near the entrance.',
            createdAt: new Date('2026-12-01T09:05:00.000Z'),
            reporter: { name: 'Reporter', phone: '+254700000001' },
            missingTourist: { name: 'Missing Tourist', phone: '+254700000002' },
          },
        ],
      });

      expect(prismaMock.report.findMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
        orderBy: { createdAt: 'desc' },
        select: {
          publicReference: true,
          type: true,
          status: true,
          lat: true,
          lng: true,
          note: true,
          createdAt: true,
          reporter: { select: { name: true, phone: true } },
          missingTourist: { select: { name: true, phone: true } },
        },
      });
    });

    it('rejects an empty tour identifier', async () => {
      await expect(service.listReportsForTour(' ')).rejects.toThrow(BadRequestException);
      expect(prismaMock.tour.findUnique).not.toHaveBeenCalled();
    });

    it('rejects listing reports for a missing tour', async () => {
      prismaMock.tour.findUnique.mockResolvedValue(null);

      await expect(service.listReportsForTour('tour-1')).rejects.toThrow(NotFoundException);
      expect(prismaMock.report.findMany).not.toHaveBeenCalled();
    });
  });

  describe('report status transitions', () => {
    it('acknowledges an OPEN report', async () => {
      prismaMock.report.findUnique.mockResolvedValue({ publicReference: 'a'.repeat(32), status: 'OPEN' });
      prismaMock.report.update.mockResolvedValue({
        publicReference: 'a'.repeat(32),
        status: 'ACKNOWLEDGED',
      });

      await expect(service.acknowledgeReport('a'.repeat(32))).resolves.toEqual({
        status: 'ok',
        data: { publicReference: 'a'.repeat(32), status: 'ACKNOWLEDGED' },
      });

      expect(prismaMock.report.update).toHaveBeenCalledWith({
        where: { publicReference: 'a'.repeat(32) },
        data: { status: 'ACKNOWLEDGED' },
        select: { publicReference: true, status: true },
      });
    });

    it('resolves an ACKNOWLEDGED report', async () => {
      prismaMock.report.findUnique.mockResolvedValue({ publicReference: 'a'.repeat(32), status: 'ACKNOWLEDGED' });
      prismaMock.report.update.mockResolvedValue({
        publicReference: 'a'.repeat(32),
        status: 'RESOLVED',
      });

      await expect(service.resolveReport('a'.repeat(32))).resolves.toEqual({
        status: 'ok',
        data: { publicReference: 'a'.repeat(32), status: 'RESOLVED' },
      });
    });

    it('rejects invalid status transitions', async () => {
      prismaMock.report.findUnique.mockResolvedValue({ publicReference: 'a'.repeat(32), status: 'RESOLVED' });

      await expect(service.acknowledgeReport('a'.repeat(32))).rejects.toThrow(ConflictException);
      await expect(service.resolveReport('a'.repeat(32))).rejects.toThrow(ConflictException);
      expect(prismaMock.report.update).not.toHaveBeenCalled();
    });

    it('rejects an empty or missing report identifier', async () => {
      await expect(service.acknowledgeReport(' ')).rejects.toThrow(BadRequestException);

      prismaMock.report.findUnique.mockResolvedValue(null);
      await expect(service.resolveReport('a'.repeat(32))).rejects.toThrow(NotFoundException);
      expect(prismaMock.report.update).not.toHaveBeenCalled();
    });
  });

  describe('getReportStatus', () => {
    it('returns a report status only for its authenticated reporter', async () => {
      prismaMock.report.findFirst.mockResolvedValue({
          publicReference: 'a'.repeat(32),
        type: 'LOST',
        status: 'ACKNOWLEDGED',
        createdAt: new Date('2026-12-01T09:00:00.000Z'),
      });

      await expect(service.getReportStatus('a'.repeat(64), 'a'.repeat(32))).resolves.toEqual({
        status: 'ok',
        data: {
          publicReference: 'a'.repeat(32),
          type: 'LOST',
          status: 'ACKNOWLEDGED',
          createdAt: new Date('2026-12-01T09:00:00.000Z'),
        },
      });

      expect(prismaMock.report.findFirst).toHaveBeenCalledWith({
        where: {
          publicReference: 'a'.repeat(32),
          reporter: { accessToken: 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb' },
        },
        select: {
          publicReference: true,
          type: true,
          status: true,
          createdAt: true,
        },
      });
    });

    it('rejects empty identifiers and unauthorized report access', async () => {
      await expect(service.getReportStatus('', 'a'.repeat(32))).rejects.toThrow(BadRequestException);
      await expect(service.getReportStatus('a'.repeat(64), '')).rejects.toThrow(BadRequestException);

      prismaMock.report.findFirst.mockResolvedValue(null);
      await expect(service.getReportStatus('b'.repeat(64), 'a'.repeat(32))).rejects.toThrow(NotFoundException);
    });

    it('rejects a valid report reference when another tourist token is supplied', async () => {
      prismaMock.report.findFirst.mockResolvedValue(null);

      await expect(service.getReportStatus('b'.repeat(64), 'a'.repeat(32)))
        .rejects.toThrow(NotFoundException);

      expect(prismaMock.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          publicReference: 'a'.repeat(32),
          reporter: { accessToken: 'a0fab1377f49a759b57f63318262ebe89fabfc990e8e93ceac2984561482b9d4' },
        }),
      }));
    });
  });
});
