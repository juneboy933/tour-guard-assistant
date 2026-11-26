import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../../reports/reports.service.js';
import { GetReportStatusTool } from './get-report-status.tool.js';

describe('GetReportStatusTool', () => {
  let tool: GetReportStatusTool;

  const reportsServiceMock = {
    getReportStatus: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetReportStatusTool,
        {
          provide: ReportsService,
          useValue: reportsServiceMock,
        },
      ],
    }).compile();

    tool = module.get<GetReportStatusTool>(GetReportStatusTool);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  it('returns only the authorized report status', async () => {
    reportsServiceMock.getReportStatus.mockResolvedValue({
      status: 'ok',
      data: {
        id: 'report-1',
        publicReference: 'a'.repeat(32),
        type: 'LOST',
        status: 'ACKNOWLEDGED',
        createdAt: new Date('2026-12-01T09:00:00.000Z'),
      },
    });

    await expect(tool.execute({
      accessToken: 'raw-token',
      reportReference: 'a'.repeat(32),
    })).resolves.toEqual({
      report: {
        reportReference: 'a'.repeat(32),
        type: 'LOST',
        status: 'ACKNOWLEDGED',
        createdAt: '2026-12-01T09:00:00.000Z',
      },
    });
  });

  it('rejects an empty report identifier before calling the service', async () => {
    await expect(tool.execute({ accessToken: 'raw-token', reportReference: ' ' })).rejects.toThrow();
    expect(reportsServiceMock.getReportStatus).not.toHaveBeenCalled();
  });
});
