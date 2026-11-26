import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { OperatorKeyGuard } from '../guides/operator-key.guard.js';
import { TouristsController } from './tourists.controller.js';
import { TouristsService } from './tourists.service.js';

describe('TouristsController', () => {
  let controller: TouristsController;

  const touristsServiceMock = {
    addTourist: vi.fn(),
    getTouristContext: vi.fn(),
    retryTouristSms: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TouristsController],
      providers: [
        {
          provide: TouristsService,
          useValue: touristsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<TouristsController>(TouristsController);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('protects tourist creation with the operator guard', () => {
    expect(Reflect.getMetadata(
      GUARDS_METADATA,
      touristsControllerMethod(controller, 'addTourist'),
    )).toContain(OperatorKeyGuard);
  });

  it('adds a tourist through the service', async () => {
    const dto = {
      name: 'Demo Tourist',
      phone: '+254712345678',
      tourId: 'tour-1',
    };
    const serviceResult = { status: 'ok', data: { publicReference: 'a'.repeat(32) } };
    touristsServiceMock.addTourist.mockResolvedValue(serviceResult);

    await expect(controller.addTourist(dto)).resolves.toEqual(serviceResult);
    expect(touristsServiceMock.addTourist).toHaveBeenCalledWith(dto);
  });

  it('retrieves tourist context from a bearer token', async () => {
    const serviceResult = { status: 'ok', data: { publicReference: 'a'.repeat(32) } };
    touristsServiceMock.getTouristContext.mockResolvedValue(serviceResult);

    await expect(
      controller.getTouristContext('Bearer raw-access-token'),
    ).resolves.toEqual(serviceResult);
    expect(touristsServiceMock.getTouristContext).toHaveBeenCalledWith('raw-access-token');
  });

  it('rejects a missing or malformed authorization header', async () => {
    expect(() => controller.getTouristContext(undefined)).toThrow(UnauthorizedException);
    expect(() => controller.getTouristContext('Basic raw-access-token')).toThrow(UnauthorizedException);
    expect(touristsServiceMock.getTouristContext).not.toHaveBeenCalled();
  });

  it('retries failed tourist SMS through the operator-protected route', async () => {
    const serviceResult = { status: 'ok', data: { publicReference: 'a'.repeat(32), smsStatus: 'SENT' } };
    touristsServiceMock.retryTouristSms.mockResolvedValue(serviceResult);

    await expect(controller.retryTouristSms('a'.repeat(32))).resolves.toEqual(serviceResult);
    expect(touristsServiceMock.retryTouristSms).toHaveBeenCalledWith('a'.repeat(32));
    expect(Reflect.getMetadata(
      GUARDS_METADATA,
      Object.getPrototypeOf(controller).retryTouristSms,
    )).toContain(OperatorKeyGuard);
  });

  it('uses the opaque public reference in the SMS retry route', () => {
    expect(Reflect.getMetadata(
      PATH_METADATA,
      Object.getPrototypeOf(controller).retryTouristSms,
    )).toBe(':publicReference/sms/retry');
  });
});

function touristsControllerMethod(controller: TouristsController, method: string): object {
  return Object.getPrototypeOf(controller)[method];
}
