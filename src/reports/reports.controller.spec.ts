import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { OperatorKeyGuard } from '../guides/operator-key.guard.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

describe('ReportsController', () => {
  let controller: ReportsController;

  const reportsServiceMock = {
    createLostReport: vi.fn(),
    createMissingReport: vi.fn(),
    listReportsForTour: vi.fn(),
    acknowledgeReport: vi.fn(),
    resolveReport: vi.fn(),
    getReportStatus: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: reportsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('creates a LOST report using the bearer token', async () => {
    const body = { lat: -1.286389, lng: 36.817223, note: 'Near the entrance.' };
    const result = { status: 'ok', data: { id: 'report-1' } };
    reportsServiceMock.createLostReport.mockResolvedValue(result);

    await expect(controller.createLostReport(body, 'Bearer raw-token')).resolves.toEqual(result);
    expect(reportsServiceMock.createLostReport).toHaveBeenCalledWith({
      ...body,
      accessToken: 'raw-token',
    });
  });

  it('creates a MISSING report using the bearer token', async () => {
    const body = {
      missingTouristReference: 'c'.repeat(32),
      note: 'Last seen near the entrance.',
    };
    const result = { status: 'ok', data: { id: 'report-2' } };
    reportsServiceMock.createMissingReport.mockResolvedValue(result);

    await expect(controller.createMissingReport(body, 'Bearer raw-token')).resolves.toEqual(result);
    expect(reportsServiceMock.createMissingReport).toHaveBeenCalledWith({
      ...body,
      accessToken: 'raw-token',
    });
  });

  it('rejects missing or malformed authorization headers', () => {
    expect(() => controller.createLostReport({}, undefined)).toThrow(UnauthorizedException);
    expect(() => controller.createMissingReport({ missingTouristReference: 'c'.repeat(32) }, 'Basic raw-token')).toThrow(UnauthorizedException);
    expect(reportsServiceMock.createLostReport).not.toHaveBeenCalled();
    expect(reportsServiceMock.createMissingReport).not.toHaveBeenCalled();
  });

  it('protects operator report routes with the operator guard', () => {
    expect(Reflect.getMetadata(
      GUARDS_METADATA,
      Object.getPrototypeOf(controller).listReportsForTour,
    )).toContain(OperatorKeyGuard);
    expect(Reflect.getMetadata(
      GUARDS_METADATA,
      Object.getPrototypeOf(controller).acknowledgeReport,
    )).toContain(OperatorKeyGuard);
    expect(Reflect.getMetadata(
      GUARDS_METADATA,
      Object.getPrototypeOf(controller).resolveReport,
    )).toContain(OperatorKeyGuard);
  });

  it('lists reports for a tour through the service', async () => {
    const result = { status: 'ok', data: [] };
    reportsServiceMock.listReportsForTour.mockResolvedValue(result);

    await expect(controller.listReportsForTour('tour-1')).resolves.toEqual(result);
    expect(reportsServiceMock.listReportsForTour).toHaveBeenCalledWith('tour-1');
  });

  it('acknowledges and resolves reports through the service', async () => {
    reportsServiceMock.acknowledgeReport.mockResolvedValue({ status: 'ok', data: { status: 'ACKNOWLEDGED' } });
    reportsServiceMock.resolveReport.mockResolvedValue({ status: 'ok', data: { status: 'RESOLVED' } });

    await expect(controller.acknowledgeReport('a'.repeat(32))).resolves.toEqual({
      status: 'ok',
      data: { status: 'ACKNOWLEDGED' },
    });
    await expect(controller.resolveReport('a'.repeat(32))).resolves.toEqual({
      status: 'ok',
      data: { status: 'RESOLVED' },
    });
  });

  it('returns report status through an authenticated tourist route', async () => {
    const result = { status: 'ok', data: { publicReference: 'a'.repeat(32), status: 'ACKNOWLEDGED' } };
    reportsServiceMock.getReportStatus.mockResolvedValue(result);

    await expect(controller.getReportStatus('a'.repeat(32), 'Bearer raw-token')).resolves.toEqual(result);
    expect(reportsServiceMock.getReportStatus).toHaveBeenCalledWith('raw-token', 'a'.repeat(32));
  });

  it('rejects a malformed status authorization header', () => {
    expect(() => controller.getReportStatus('a'.repeat(32), 'Basic raw-token')).toThrow(UnauthorizedException);
    expect(reportsServiceMock.getReportStatus).not.toHaveBeenCalled();
  });
});
