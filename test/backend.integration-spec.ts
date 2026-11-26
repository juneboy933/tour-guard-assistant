import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ReportsService } from '../src/reports/reports.service.js';
import { TouristsService } from '../src/tourists/tourists.service.js';

describe('backend PostgreSQL integration', () => {
  const prisma = new PrismaService();
  const smsService = { sendSms: vi.fn().mockResolvedValue(undefined) };
  let guideId: string;
  let tourId: string;

  beforeAll(async () => {
    process.env.TOURIST_ASSISTANT_BASE_URL = 'https://assistant.example.test';
    await prisma.$connect();
  });

  afterAll(async () => {
    if (tourId) {
      await prisma.report.deleteMany({ where: { tourId } });
      await prisma.tourist.deleteMany({ where: { tourId } });
      await prisma.tour.delete({ where: { id: tourId } });
    }
    if (guideId) {
      await prisma.guide.delete({ where: { id: guideId } });
    }
    await prisma.$disconnect();
  });

  it('persists secure tourist state and authorized reports', async () => {
    const suffix = `${Date.now()}${randomUUID().replace(/-/g, '')}`.replace(/\D/g, '').slice(-6);
    const guide = await prisma.guide.create({
      data: {
        name: `Integration Guide ${suffix}`,
        phone: `+2547${suffix.slice(0, 6)}01`,
        publicReference: randomUUID().replace(/-/g, ''),
      },
    });
    guideId = guide.id;

    const tour = await prisma.tour.create({
      data: {
        name: `Integration Tour ${suffix}`,
        description: 'Integration test tour.',
        meetingPoint: 'Integration meeting point',
        startAt: new Date('2030-01-01T08:00:00.000Z'),
        endAt: new Date('2030-01-01T12:00:00.000Z'),
        guideId,
      },
    });
    tourId = tour.id;

    const touristsService = new TouristsService(prisma, smsService);
    const created = await touristsService.addTourist({
      name: `Integration Tourist ${suffix}`,
      phone: `+2547${suffix.slice(0, 6)}02`,
      tourId,
    });
    const rawToken = created.data.secureLink.split('/').pop() as string;

    const stored = await prisma.tourist.findUnique({
      where: { publicReference: created.data.publicReference },
      select: { accessToken: true, smsStatus: true, publicReference: true },
    });
    expect(stored?.accessToken).not.toBe(rawToken);
    expect(stored?.accessToken).toHaveLength(64);
    expect(stored?.smsStatus).toBe('SENT');
    expect(stored?.publicReference).toHaveLength(32);

    const context = await touristsService.getTouristContext(rawToken);
    expect(context.data).not.toHaveProperty('id');
    expect(context.data.tour).not.toHaveProperty('id');
    expect(context.data).not.toHaveProperty('tourists');

    const reportsService = new ReportsService(prisma);
    const report = await reportsService.createLostReport({ accessToken: rawToken });
    expect(report.data.status).toBe('OPEN');
    expect(report.data.type).toBe('LOST');
  });
});
