import { Test, TestingModule } from '@nestjs/testing';
import { GuidesService } from './guides.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('GuidesService', () => {
  let service: GuidesService;

  // Fake database
  const prismaMock = {
    guide: {
      create: vi.fn(),
      findFirst: vi.fn(),
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuidesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        }
      ],
    }).compile();

    service = module.get<GuidesService>(GuidesService);

    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createGuide', () => {
    it('creates guide with valid data', async() => {
      prismaMock.guide.findFirst.mockResolvedValue(null);
      prismaMock.guide.create.mockResolvedValue({
        id: 1,
        name: 'Demo Guide',
        phone: '+254712345678',
        publicReference: 'a'.repeat(32),
      });
  
      const res = await service.createGuide({ 
        name: 'Demo Guide', 
        phone: '+254712345678'
      });
  
      expect(res).toEqual({
        status: 'ok',
        data: {
          name: 'Demo Guide',
          phone: '+254712345678',
          publicReference: 'a'.repeat(32),
        }
      });
  
      expect(prismaMock.guide.create).toHaveBeenCalledWith({
        data: {
          name: 'Demo Guide',
          phone: '+254712345678',
        publicReference: expect.stringMatching(/^[a-f0-9]{32}$/),
      }
      });
    });
  
    it('rejects an empty name field', async() => {
      await expect(
        service.createGuide({ name: '', phone: '+254712345678'})
      ).rejects.toThrow(BadRequestException);
  
      expect(prismaMock.guide.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.guide.create).not.toHaveBeenCalled();
    });
  
    it('rejects an empty phone field', async() => {
      await expect(
        service.createGuide({
          name: 'Demo Guide',
          phone: '',
        })
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.guide.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.guide.create).not.toHaveBeenCalled();
    })

    it('rejects whitespace-only values', async() => {
      await expect(
        service.createGuide({
          name: '  ',
          phone: '+254712345678',
        })
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createGuide({
          name: 'Demo Guide',
          phone: '  ',
        })
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.guide.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.guide.create).not.toHaveBeenCalled();
    })

    it('rejects values that fail DTO validation when called directly', async () => {
      await expect(
        service.createGuide({ name: 123 as unknown as string, phone: '+254712345678' }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.guide.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.guide.create).not.toHaveBeenCalled();
    });

   it('does not create a duplicate guide with the same phone number', async () => {
      prismaMock.guide.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 1,
        name: 'Existing Guide',
        phone: '+254712345678',
      });

      prismaMock.guide.create.mockResolvedValue({
        id: 1,
        name: 'Demo Guide',
        phone: '+254712345678',
      });

    await service.createGuide({
      name: 'Demo Guide',
      phone: '+254712345678',
    });

    await expect(
      service.createGuide({
        name: 'Another Guide',
        phone: '+254712345678',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.guide.create).toHaveBeenCalledTimes(1);
  });

  it('maps a database duplicate error to BadRequestException', async () => {
    prismaMock.guide.findFirst.mockResolvedValue(null);
    prismaMock.guide.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.createGuide({ name: 'Demo Guide', phone: '+254712345678' }),
    ).rejects.toThrow(BadRequestException);
  });

  })

  describe('findGuideByPhone', () => {
    it('returns the guide when phone the exist', async() => {
      prismaMock.guide.findFirst.mockResolvedValue({
        id: 1,
        name: 'Demo Guide',
        phone: '+254712345678',
        publicReference: 'a'.repeat(32),
      })

      const result = await service.findGuideByPhone('+254712345678');

      expect(result).toEqual({
        name: 'Demo Guide',
        phone: '+254712345678',
        publicReference: 'a'.repeat(32),
      });

      expect(prismaMock.guide.findFirst).toHaveBeenCalledWith({
        where: {
          phone: '+254712345678'
        }
      })
    })

    it('throws NotFoundException when the guide does not exist', async () => {
      prismaMock.guide.findFirst.mockResolvedValue(null);

      await expect(
        service.findGuideByPhone('+254712345678'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an empty phone number', async () => {
      await expect(
        service.findGuideByPhone(''),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.guide.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a whitespace-only phone number', async () => {
      await expect(
        service.findGuideByPhone('   '),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.guide.findFirst).not.toHaveBeenCalled();
    });
  })
});
