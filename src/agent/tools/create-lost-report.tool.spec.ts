import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../../reports/reports.service.js';
import { CreateLostReportTool } from './create-lost-report.tool.js';

describe('CreateLostReportTool', () => {
  let tool: CreateLostReportTool;

  const reportsServiceMock = {
    createLostReport: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateLostReportTool,
        {
          provide: ReportsService,
          useValue: reportsServiceMock,
        },
      ],
    }).compile();

    tool = module.get<CreateLostReportTool>(CreateLostReportTool);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  it('creates a LOST report through the authorized report service', async () => {
    reportsServiceMock.createLostReport.mockResolvedValue({
      status: 'ok',
      data: {
        publicReference: 'a'.repeat(32),
        type: 'LOST',
        status: 'OPEN',
        createdAt: new Date('2026-12-01T09:00:00.000Z'),
      },
    });

    await expect(tool.execute({
      accessToken: 'raw-token',
      lat: -1.286389,
      lng: 36.817223,
      note: 'Near the entrance.',
    })).resolves.toEqual({
      report: {
        reportReference: 'a'.repeat(32),
        type: 'LOST',
        status: 'OPEN',
        createdAt: '2026-12-01T09:00:00.000Z',
      },
    });

    expect(reportsServiceMock.createLostReport).toHaveBeenCalledWith({
      accessToken: 'raw-token',
      lat: -1.286389,
      lng: 36.817223,
      note: 'Near the entrance.',
    });
  });

  it('rejects an empty access token before calling the service', async () => {
    await expect(tool.execute({ accessToken: ' ' })).rejects.toThrow();
    expect(reportsServiceMock.createLostReport).not.toHaveBeenCalled();
  });
});
