import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E test for the health check endpoint.
 *
 * Prerequisites:
 *   - PostgreSQL container running: `docker compose up -d`
 *   - Database accessible on localhost:5432
 */
describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['health'],
    });
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /health should return healthy status and database status up', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: { body: { status: string; info: { database: { status: string } } } }) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.info).toBeDefined();
        expect(res.body.info.database).toBeDefined();
        expect(res.body.info.database.status).toBe('up');
      });
  });

  it('GET /health response should have correct Terminus structure', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: { body: Record<string, unknown> }) => {
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('info');
        expect(res.body).toHaveProperty('error');
        expect(res.body).toHaveProperty('details');
      });
  });
});
