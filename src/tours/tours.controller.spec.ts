import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OperatorKeyGuard } from '../guides/operator-key.guard.js';
import { ToursController } from './tours.controller.js';
import { ToursService } from './tours.service.js';

describe('ToursController', () => {
  let controller: ToursController;

  const toursServiceMock = {
    createTour: vi.fn(),
    findTourById: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToursController],
      providers: [
        {
          provide: ToursService,
          useValue: toursServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ToursController>(ToursController);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('protects all Tour routes with the operator guard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ToursController)).toContain(OperatorKeyGuard);
  });

  it('creates a tour through the service', async () => {
    const dto = {
      name: 'Nairobi City Tour',
      description: 'A guided city tour.',
      meetingPoint: 'Kenya National Archives',
      startAt: '2026-12-01T08:00:00.000Z',
      endAt: '2026-12-01T12:00:00.000Z',
      guideReference: 'a'.repeat(32),
    };
    const serviceResult = {
      status: 'ok',
      data: { id: 'tour-1', name: dto.name },
    };
    toursServiceMock.createTour.mockResolvedValue(serviceResult);

    await expect(controller.createTour(dto)).resolves.toEqual(serviceResult);
    expect(toursServiceMock.createTour).toHaveBeenCalledWith(dto);
  });

  it('returns a tour by identifier through the service', async () => {
    const serviceResult = {
      status: 'ok',
      data: { id: 'tour-1', name: 'Nairobi City Tour' },
    };
    toursServiceMock.findTourById.mockResolvedValue(serviceResult);

    await expect(controller.findTourById('tour-1')).resolves.toEqual(serviceResult);
    expect(toursServiceMock.findTourById).toHaveBeenCalledWith('tour-1');
  });
});
