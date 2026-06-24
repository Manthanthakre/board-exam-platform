import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Notification Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('should return 200 with status ok (public endpoint)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });
  });

  describe('GET /api/v1/logs/:studentId', () => {
    it('should return 401 without a token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/logs/student-uuid-1')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it('should return 401 with a malformed token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/logs/student-uuid-1')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('Error shape consistency', () => {
    it('should always return standardised error shape on 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/route-does-not-exist')
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});
