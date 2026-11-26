import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

process.env.OPERATOR_API_KEY = 'e2e-test-operator-key';
process.env.TOURIST_ASSISTANT_BASE_URL = 'https://assistant.example.test';
process.env.AT_USERNAME = '';
process.env.AT_API_KEY = '';
process.env.AT_SHORTCODE = '';
process.env.AT_SENDER_ID = '';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/')
      .expect(200)
      .expect('Hello From Tour Guard Assistant!');
  });

  it('creates a tour, adds a tourist, and returns authorized tourist context', async () => {
    const prisma = app.get(PrismaService);
    const suffix = `${Date.now()}`.slice(-6);
    const guide = await prisma.guide.create({
      data: {
        name: `E2E Guide ${suffix}`,
        phone: `+2547${suffix}01`,
        publicReference: randomUUID().replace(/-/g, ''),
      },
    });
    let tourId: string | undefined;

    try {
      const tourResponse = await request(app.getHttpServer())
        .post('/api/v1/tours')
        .set('X-Operator-Key', 'e2e-test-operator-key')
        .send({
          name: `E2E Tour ${suffix}`,
          description: 'E2E tour.',
          meetingPoint: 'E2E meeting point',
          startAt: '2030-01-01T08:00:00.000Z',
          endAt: '2030-01-01T12:00:00.000Z',
          guideReference: guide.publicReference,
        })
        .expect(201);
      tourId = tourResponse.body.data.id;

      const touristResponse = await request(app.getHttpServer())
        .post('/api/v1/tourists')
        .set('X-Operator-Key', 'e2e-test-operator-key')
        .send({
          name: `E2E Tourist ${suffix}`,
          phone: `+2547${suffix}02`,
          tourId,
        })
        .expect(201);

      expect(touristResponse.body.data.smsStatus).toBe('FAILED');
      const rawToken = touristResponse.body.data.secureLink.split('/').pop();

      const contextResponse = await request(app.getHttpServer())
        .get('/api/v1/tourists/context')
        .set('Authorization', `Bearer ${rawToken}`)
        .expect(200);

      expect(contextResponse.body.data.tour.name).toBe(`E2E Tour ${suffix}`);
      expect(contextResponse.body.data).not.toHaveProperty('tourists');

      await request(app.getHttpServer())
        .post('/api/v1/tours')
        .set('X-Operator-Key', 'e2e-test-operator-key')
        .send({
          name: 'Invalid reference tour',
          description: 'Should be rejected.',
          meetingPoint: 'E2E meeting point',
          startAt: '2030-01-01T08:00:00.000Z',
          endAt: '2030-01-01T12:00:00.000Z',
          guideReference: 'not-a-public-reference',
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/reports/missing')
        .set('Authorization', `Bearer ${rawToken}`)
        .send({ missingTouristReference: 'not-a-public-reference' })
        .expect(400);

      const secondTouristResponse = await request(app.getHttpServer())
        .post('/api/v1/tourists')
        .set('X-Operator-Key', 'e2e-test-operator-key')
        .send({
          name: `E2E Missing Tourist ${suffix}`,
          phone: `+2547${suffix}03`,
          tourId,
        })
        .expect(201);
      const missingTouristReference = secondTouristResponse.body.data.publicReference;

      const lostResponse = await request(app.getHttpServer())
        .post('/api/v1/reports/lost')
        .set('Authorization', `Bearer ${rawToken}`)
        .send({ note: 'I am near the meeting point.' })
        .expect(201);
      const lostReportReference = lostResponse.body.data.publicReference;

      const missingResponse = await request(app.getHttpServer())
        .post('/api/v1/reports/missing')
        .set('Authorization', `Bearer ${rawToken}`)
        .send({ missingTouristReference, note: 'I cannot find my group member.' })
        .expect(201);
      expect(missingResponse.body.data.type).toBe('MISSING');
      expect(missingResponse.body.data.publicReference).toMatch(/^[a-f0-9]{32}$/);

      await request(app.getHttpServer())
        .get(`/api/v1/reports/tour/${tourId}`)
        .set('X-Operator-Key', 'e2e-test-operator-key')
        .expect(200)
        .expect((response) => {
          expect(response.body.data).toHaveLength(2);
          expect(response.body.data[0].id).toBeUndefined();
          expect(response.body.data[0].publicReference).toMatch(/^[a-f0-9]{32}$/);
        });

      await request(app.getHttpServer())
        .patch(`/api/v1/reports/${lostReportReference}/acknowledge`)
        .set('X-Operator-Key', 'e2e-test-operator-key')
        .expect(200)
        .expect(({ body }) => expect(body.data.status).toBe('ACKNOWLEDGED'));

      await request(app.getHttpServer())
        .get(`/api/v1/reports/status/${lostReportReference}`)
        .set('Authorization', `Bearer ${rawToken}`)
        .expect(200)
        .expect(({ body }) => expect(body.data.status).toBe('ACKNOWLEDGED'));

      const secondRawToken = secondTouristResponse.body.data.secureLink.split('/').pop();
      await request(app.getHttpServer())
        .get(`/api/v1/reports/status/${lostReportReference}`)
        .set('Authorization', `Bearer ${secondRawToken}`)
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/api/v1/reports/${lostReportReference}/resolve`)
        .set('X-Operator-Key', 'e2e-test-operator-key')
        .expect(200)
        .expect(({ body }) => expect(body.data.status).toBe('RESOLVED'));

    } finally {
      if (tourId) {
        await prisma.report.deleteMany({ where: { tourId } });
        await prisma.tourist.deleteMany({ where: { tourId } });
        await prisma.tour.delete({ where: { id: tourId } });
      }
      await prisma.guide.delete({ where: { id: guide.id } });
    }
  });

  afterEach(async () => {
    await app.close();
  });
});
