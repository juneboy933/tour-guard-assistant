import { Test, TestingModule } from '@nestjs/testing';
import { GuidesController } from './guides.controller.js';
import { GuidesService } from './guides.service.js';

describe('GuidesController', () => {
  let controller: GuidesController;

  const guidesServiceMock = {
    findGuideByPhone: vi.fn(),
    createGuide: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GuidesController],
      providers: [
        {
          provide: GuidesService,
          useValue: guidesServiceMock,
        },
      ],
    }).compile();

    controller = module.get<GuidesController>(GuidesController);

    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns a guide found by phone number', async () => {
    guidesServiceMock.findGuideByPhone.mockResolvedValue({
      name: 'Demo Guide',
      phone: '+254712345678',
      publicReference: 'a'.repeat(32),
    });

    const result = await controller.findGuideByPhone(
      '+254712345678',
    );

    expect(result).toEqual({
      name: 'Demo Guide',
      phone: '+254712345678',
      publicReference: 'a'.repeat(32),
    });

    expect(
      guidesServiceMock.findGuideByPhone,
    ).toHaveBeenCalledWith('+254712345678');
  });

  it('creates a new guide', async () => {
    guidesServiceMock.createGuide.mockResolvedValue({
    status: 'ok',
    data: {
      name: 'Demo Guide',
      phone: '+254712345678',
      publicReference: 'a'.repeat(32),
    },
  });

  const dto = {
    name: 'Demo Guide',
    phone: '+254712345678',
  };

  const result = await controller.createGuide(dto);

  expect(result).toEqual({
    status: 'ok',
    data: {
      name: 'Demo Guide',
      phone: '+254712345678',
      publicReference: 'a'.repeat(32),
    },
  });

  expect(guidesServiceMock.createGuide).toHaveBeenCalledWith(dto);
});
});
