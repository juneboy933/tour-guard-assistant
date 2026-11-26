import { Test, TestingModule } from '@nestjs/testing';
import { TouristsService } from '../../tourists/tourists.service.js';
import { GetGuideContactTool } from './get-guide-contact.tool.js';

describe('GetGuideContactTool', () => {
  let tool: GetGuideContactTool;

  const touristsServiceMock = {
    getTouristContext: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetGuideContactTool,
        {
          provide: TouristsService,
          useValue: touristsServiceMock,
        },
      ],
    }).compile();

    tool = module.get<GetGuideContactTool>(GetGuideContactTool);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  it('returns only the authorized guide contact', async () => {
    touristsServiceMock.getTouristContext.mockResolvedValue({
      status: 'ok',
      data: {
        name: 'Demo Tourist',
        phone: '+254712345678',
        publicReference: 'c'.repeat(32),
        tour: {
          name: 'Nairobi City Tour',
          guide: {
            name: 'Demo Guide',
            phone: '+254700000001',
          },
        },
      },
    });

    await expect(tool.execute({ accessToken: 'raw-token' })).resolves.toEqual({
      guide: {
        name: 'Demo Guide',
        phone: '+254700000001',
      },
    });
    expect(touristsServiceMock.getTouristContext).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty access token before calling the service', async () => {
    await expect(tool.execute({ accessToken: '' })).rejects.toThrow();
    expect(touristsServiceMock.getTouristContext).not.toHaveBeenCalled();
  });
});
