import { Test, TestingModule } from '@nestjs/testing';
import { TouristsService } from '../../tourists/tourists.service.js';
import { GetTouristContextTool } from './get-tourist-context.tool.js';

describe('GetTouristContextTool', () => {
  let tool: GetTouristContextTool;

  const touristsServiceMock = {
    getTouristContext: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTouristContextTool,
        {
          provide: TouristsService,
          useValue: touristsServiceMock,
        },
      ],
    }).compile();

    tool = module.get<GetTouristContextTool>(GetTouristContextTool);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  it('returns a small sanitized tourist context', async () => {
    touristsServiceMock.getTouristContext.mockResolvedValue({
      status: 'ok',
      data: {
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
        },
      },
    });

    const result = await tool.execute({ accessToken: 'raw-token' });

    expect(result).toEqual({
      tourist: {
        name: 'Demo Tourist',
        phone: '+254712345678',
        publicReference: 'c'.repeat(32),
      },
      tour: {
        name: 'Nairobi City Tour',
        description: 'A guided city tour.',
        meetingPoint: 'Kenya National Archives',
        startAt: '2026-12-01T08:00:00.000Z',
        endAt: '2026-12-01T12:00:00.000Z',
        guide: {
          name: 'Demo Guide',
          phone: '+254712345678',
        },
      },
    });
    expect(result).not.toHaveProperty('id');
    expect(JSON.stringify(result)).not.toContain('tourist-1');
    expect(JSON.stringify(result)).not.toContain('tour-1');
    expect(touristsServiceMock.getTouristContext).toHaveBeenCalledWith('raw-token');
  });

  it('rejects an empty access token before calling the service', async () => {
    await expect(tool.execute({ accessToken: ' ' })).rejects.toThrow();
    expect(touristsServiceMock.getTouristContext).not.toHaveBeenCalled();
  });
});
