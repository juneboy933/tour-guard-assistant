import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { SMS_SERVICE } from '../sms/sms.service.js';
import { TouristsService } from './tourists.service.js';

describe('TouristsService', () => {
  let service: TouristsService;

  const prismaMock = {
    tour: {
      findUnique: vi.fn(),
    },
    tourist: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const smsServiceMock = {
    sendSms: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TouristsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: SMS_SERVICE,
          useValue: smsServiceMock,
        },
      ],
    }).compile();

    service = module.get<TouristsService>(TouristsService);
    vi.resetAllMocks();
    smsServiceMock.sendSms.mockResolvedValue(undefined);
    process.env.TOURIST_ASSISTANT_BASE_URL = 'https://assistant.example.test';
  });

  afterEach(() => {
    delete process.env.TOURIST_ASSISTANT_BASE_URL;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addTourist', () => {
    const validDto = {
      name: 'Demo Tourist',
      phone: '+254712345678',
      tourId: 'tour-1',
    };

    it('adds a tourist and returns a secure assistant link', async () => {
      prismaMock.tour.findUnique.mockResolvedValue({ id: 'tour-1' });
      prismaMock.tourist.findFirst.mockResolvedValue(null);
      prismaMock.tourist.create.mockImplementation(({ data }) => ({
        id: 'tourist-1',
        name: data.name,
        phone: data.phone,
        tourId: data.tourId,
        publicReference: data.publicReference,
      }));

      const result = await service.addTourist(validDto);

      expect(result.status).toBe('ok');
      expect(result.data).toMatchObject({
        name: 'Demo Tourist',
        phone: '+254712345678',
      });
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('tourId');
      expect(result.data.publicReference).toMatch(/^[a-f0-9]{32}$/);
      expect(result.data.secureLink).toMatch(/^https:\/\/assistant\.example\.test\/tourist\/.+/);

      const createCall = prismaMock.tourist.create.mock.calls[0][0];
      expect(createCall.data.accessToken).toMatch(/^[a-f0-9]{64}$/);
      expect(createCall.data.publicReference).toMatch(/^[a-f0-9]{32}$/);
      expect(createCall.data.smsStatus).toBe('PENDING');
      expect(result.data.secureLink).not.toContain(createCall.data.accessToken);
      expect(smsServiceMock.sendSms).toHaveBeenCalledWith(
        '+254712345678',
        expect.stringContaining(result.data.secureLink),
      );
    });

    it.each([
      ['name', { ...validDto, name: ' ' }],
      ['phone', { ...validDto, phone: '' }],
      ['tour', { ...validDto, tourId: '' }],
    ])('rejects an invalid %s', async (_field, dto) => {
      await expect(service.addTourist(dto)).rejects.toThrow(BadRequestException);

      expect(prismaMock.tour.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.tourist.create).not.toHaveBeenCalled();
    });

    it('rejects a tourist when the tour does not exist', async () => {
      prismaMock.tour.findUnique.mockResolvedValue(null);

      await expect(service.addTourist(validDto)).rejects.toThrow(NotFoundException);
      expect(prismaMock.tourist.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate phone number within the same tour', async () => {
      prismaMock.tour.findUnique.mockResolvedValue({ id: 'tour-1' });
      prismaMock.tourist.findFirst.mockResolvedValue({ id: 'existing-tourist' });

      await expect(service.addTourist(validDto)).rejects.toThrow(BadRequestException);
      expect(prismaMock.tourist.create).not.toHaveBeenCalled();
    });

    it('does not send an SMS when tourist creation fails', async () => {
      prismaMock.tour.findUnique.mockResolvedValue({ id: 'tour-1' });
      prismaMock.tourist.findFirst.mockResolvedValue(null);
      prismaMock.tourist.create.mockRejectedValue(new Error('database unavailable'));

      await expect(service.addTourist(validDto)).rejects.toThrow('database unavailable');
      expect(smsServiceMock.sendSms).not.toHaveBeenCalled();
    });

    it('reports SMS delivery failure without leaking provider details', async () => {
      prismaMock.tour.findUnique.mockResolvedValue({ id: 'tour-1' });
      prismaMock.tourist.findFirst.mockResolvedValue(null);
      prismaMock.tourist.create.mockImplementation(({ data }) => ({
        id: 'tourist-1',
        name: data.name,
        phone: data.phone,
        tourId: data.tourId,
        publicReference: data.publicReference,
      }));
      smsServiceMock.sendSms.mockRejectedValue(new Error('provider credential detail'));

      const result = await service.addTourist(validDto);

      expect(result.data.smsStatus).toBe('FAILED');
      expect(JSON.stringify(result)).not.toContain('provider credential detail');
      expect(prismaMock.tourist.update).toHaveBeenCalledWith({
        where: { id: 'tourist-1' },
        data: {
          smsStatus: 'FAILED',
          smsFailureReason: 'SMS delivery failed.',
        },
      });
    });
  });

  describe('getTouristContext', () => {
    it('returns only the authenticated tourist context', async () => {
      prismaMock.tourist.findUnique
        .mockResolvedValueOnce({ id: 'tourist-1' })
        .mockResolvedValueOnce({
        id: 'tourist-1',
        name: 'Demo Tourist',
        phone: '+254712345678',
        publicReference: 'c'.repeat(32),
        tour: {
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
          tourists: [],
        },
      });

      const result = await service.getTouristContext('a'.repeat(64));

      expect(result).toEqual({
        status: 'ok',
        data: {
          name: 'Demo Tourist',
          phone: '+254712345678',
          publicReference: 'c'.repeat(32),
          tour: {
            name: 'Nairobi City Tour',
            description: 'A guided city tour.',
            meetingPoint: 'Kenya National Archives',
            startAt: new Date('2026-12-01T08:00:00.000Z'),
            endAt: new Date('2026-12-01T12:00:00.000Z'),
            guide: {
              name: 'Demo Guide',
              phone: '+254712345678',
            },
            tourists: [],
          },
        },
      });

      expect(prismaMock.tourist.findUnique).toHaveBeenNthCalledWith(1, {
        where: {
          accessToken: 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb',
        },
        select: {
          id: true,
        },
      });
      expect(prismaMock.tourist.findUnique).toHaveBeenCalledTimes(2);
    });

    it('rejects an empty access token', async () => {
      await expect(service.getTouristContext('')).rejects.toThrow(BadRequestException);

      expect(prismaMock.tourist.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an unknown access token without revealing whether a tourist exists', async () => {
      prismaMock.tourist.findUnique.mockResolvedValue(null);

      await expect(service.getTouristContext('b'.repeat(64))).rejects.toThrow(NotFoundException);
    });
  });

  describe('retryTouristSms', () => {
    it('rejects a malformed public reference before querying', async () => {
      await expect(service.retryTouristSms('not-a-public-reference'))
        .rejects.toThrow(BadRequestException);

      expect(prismaMock.tourist.findUnique).not.toHaveBeenCalled();
    });

    it('rotates the token and resends only for a FAILED tourist', async () => {
      prismaMock.tourist.findUnique.mockResolvedValue({
        id: 'tourist-1',
        publicReference: 'd'.repeat(32),
        phone: '+254712345678',
        smsStatus: 'FAILED',
      });
      prismaMock.tourist.update.mockResolvedValue(undefined);

      const result = await service.retryTouristSms('d'.repeat(32));

      expect(result.status).toBe('ok');
      expect(result.data.publicReference).toBe('d'.repeat(32));
      expect(result.data).not.toHaveProperty('id');
      expect(result.data.smsStatus).toBe('SENT');
      expect(result.data.secureLink).toMatch(/^https:\/\/assistant\.example\.test\/tourist\/[a-f0-9]{64}$/);
      expect(smsServiceMock.sendSms).toHaveBeenCalledWith(
        '+254712345678',
        expect.stringContaining(result.data.secureLink),
      );
      expect(prismaMock.tourist.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
        where: { id: 'tourist-1' },
        data: expect.objectContaining({
          accessToken: expect.stringMatching(/^[a-f0-9]{64}$/),
          smsStatus: 'PENDING',
        }),
      }));
      expect(prismaMock.tourist.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
        where: { id: 'tourist-1' },
        data: expect.objectContaining({
          smsStatus: 'SENT',
          smsFailureReason: null,
        }),
      }));
    });

    it('rejects retrying a tourist who is not in FAILED status', async () => {
      prismaMock.tourist.findUnique.mockResolvedValue({
        id: 'tourist-1',
        publicReference: 'd'.repeat(32),
        phone: '+254712345678',
        smsStatus: 'SENT',
      });

      await expect(service.retryTouristSms('d'.repeat(32))).rejects.toThrow(ConflictException);
      expect(smsServiceMock.sendSms).not.toHaveBeenCalled();
    });

    it('marks the retry FAILED without leaking provider details', async () => {
      prismaMock.tourist.findUnique.mockResolvedValue({
        id: 'tourist-1',
        publicReference: 'd'.repeat(32),
        phone: '+254712345678',
        smsStatus: 'FAILED',
      });
      smsServiceMock.sendSms.mockRejectedValue(new Error('provider secret'));

      const result = await service.retryTouristSms('d'.repeat(32));

      expect(result.data.smsStatus).toBe('FAILED');
      expect(JSON.stringify(result)).not.toContain('provider secret');
      expect(prismaMock.tourist.update).toHaveBeenLastCalledWith(expect.objectContaining({
        data: {
          smsStatus: 'FAILED',
          smsFailureReason: 'SMS delivery failed.',
        },
      }));
    });
  });
});
