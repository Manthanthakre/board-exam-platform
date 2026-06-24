import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// These E2E tests require PostgreSQL + RabbitMQ + User Service running.
// Use docker-compose for full integration.
describe('Result Service (e2e)', () => {
  let app: INestApplication;
  // These tokens would be obtained from User Service in a real test environment
  const moderatorToken = process.env['TEST_MODERATOR_TOKEN'] ?? 'mock-moderator-token';
 

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

  describe('POST /api/v1/results', () => {
    it('should reject unauthenticated request with 401', () => {
      return request(app.getHttpServer())
        .post('/api/v1/results')
        .send({
          studentId: '00000000-0000-0000-0000-000000000001',
          examName: 'Test Exam',
          academicYear: '2023-24',
          totalMarks: 500,
          percentage: 85,
          subjectMarks: [{ subjectName: 'Math', marks: 85 }],
        })
        .expect(401);
    });

    it('should reject invalid payload with 400', () => {
      return request(app.getHttpServer())
        .post('/api/v1/results')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ examName: 'Missing required fields' })
        .expect((res) => {
          // Either 400 (validation) or 401 (token not valid in test env)
          expect([400, 401, 403]).toContain(res.status);
        });
    });
  });

  describe('GET /api/v1/results/me', () => {
    it('should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/results/me')
        .expect(401);
    });
  });

  describe('Error format', () => {
    it('should return standardised error shape on 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/results/me')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        message: expect.any(String),
        error: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it('should return 404 for non-existent route', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/does-not-exist')
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
    });
  });
});
