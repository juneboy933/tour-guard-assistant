import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../../reports/reports.service.js';
import { CreateMissingReportTool } from './create-missing-report.tool.js';

describe('CreateMissingReportTool', () => {
  let tool: CreateMissingReportTool;

  const reportsServiceMock = {
    createMissingReport: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateMissingReportTool,
        {
          provide: ReportsService,
          useValue: reportsServiceMock,
        },
      ],
    }).compile();

    tool = module.get<CreateMissingReportTool>(CreateMissingReportTool);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  it('creates a MISSING report through the authorized report service', async () => {
    reportsServiceMock.createMissingReport.mockResolvedValue({
      status: 'ok',
      data: {
        publicReference: 'b'.repeat(32),
        type: 'MISSING',
        status: 'OPEN',
        createdAt: new Date('2026-12-01T09:05:00.000Z'),
      },
    });

    await expect(tool.execute({
      accessToken: 'raw-token',
      missingTouristReference: 'c'.repeat(32),
      note: 'Last seen near the entrance.',
    })).resolves.toEqual({
      report: {
        reportReference: 'b'.repeat(32),
        type: 'MISSING',
        status: 'OPEN',
        createdAt: '2026-12-01T09:05:00.000Z',
      },
    });

    expect(reportsServiceMock.createMissingReport).toHaveBeenCalledWith({
      accessToken: 'raw-token',
      missingTouristReference: 'c'.repeat(32),
      note: 'Last seen near the entrance.',
    });
  });

  it('rejects an invalid missing tourist reference before calling the service', async () => {
    await expect(tool.execute({
      accessToken: 'raw-token',
      missingTouristReference: ' ',
    })).rejects.toThrow();
    expect(reportsServiceMock.createMissingReport).not.toHaveBeenCalled();
  });
});
