import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

// These E2E tests require a running PostgreSQL instance.
// Set TEST_DB_* env vars or use docker-compose test profile.
describe('User Service (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;

  const testUser = {
    fullName: 'E2E Student',
    email: `e2e_${Date.now()}@test.com`,
    password: 'SecureP@ss1',
    rollNumber: `ROLL${Date.now()}`,
    role: 'STUDENT',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(testUser.email);
      accessToken = res.body.accessToken as string;
      refreshToken = res.body.refreshToken as string;
    });

    it('should reject duplicate email with 409', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(409);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject invalid credentials with 401', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'wrong' })
        .expect(401);
    });
  });

  describe('GET /api/v1/profile', () => {
    it('should return own profile when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/profile')
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should issue new access token using valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
    });
  });
});
