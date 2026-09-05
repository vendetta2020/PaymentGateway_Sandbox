import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { MerchantStatus } from '../src/merchant/enums/merchant-status.enum';

describe('MerchantController (e2e)', () => {
  let app: INestApplication;
  let createdMerchantId: string;
  const uniqueSuffix = Date.now();
  const testEmail = `merchant_${uniqueSuffix}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api/v1', {
      exclude: ['health'],
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/merchants', () => {
    it('should create a valid merchant with status 201', async () => {
      const payload = {
        name: 'PT Toko Sejahtera',
        businessName: 'Toko Sejahtera Indonesia PT',
        email: testEmail,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send(payload)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(payload.name);
      expect(response.body.businessName).toBe(payload.businessName);
      expect(response.body.email).toBe(testEmail.toLowerCase());
      expect(response.body.status).toBe(MerchantStatus.ACTIVE);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');

      createdMerchantId = response.body.id;
    });

    it('should reject merchant creation with duplicate email with status 409', async () => {
      const payload = {
        name: 'Duplicate Company',
        businessName: 'Duplicate Company PT',
        email: testEmail, // same email as previous test
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send(payload)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(409);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject creation with missing required fields with status 400', async () => {
      const invalidPayload = {
        name: 'Incomplete Merchant',
        // businessName and email missing
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(Array.isArray(response.body.details)).toBe(true);
    });

    it('should reject creation with invalid email format with status 400', async () => {
      const invalidPayload = {
        name: 'Invalid Email Merchant',
        businessName: 'Invalid Co',
        email: 'not-an-email',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/merchants/:id', () => {
    it('should retrieve existing merchant by id with status 200', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/merchants/${createdMerchantId}`)
        .expect(200);

      expect(response.body.id).toBe(createdMerchantId);
      expect(response.body.email).toBe(testEmail.toLowerCase());
      expect(response.body.status).toBe(MerchantStatus.ACTIVE);
    });

    it('should return 404 when merchant id does not exist', async () => {
      const nonExistentUuid = 'a0000000-0000-4000-8000-000000000000';

      const response = await request(app.getHttpServer())
        .get(`/api/v1/merchants/${nonExistentUuid}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/merchants/not-a-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/merchants', () => {
    it('should return list of merchants with status 200', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/merchants').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      const found = response.body.find((m: { id: string }) => m.id === createdMerchantId);
      expect(found).toBeDefined();
    });
  });
});
