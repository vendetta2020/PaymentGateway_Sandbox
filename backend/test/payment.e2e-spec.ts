import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { Merchant } from '../src/merchant/entities/merchant.entity';
import { ApiCredentialService } from '../src/auth/services/api-credential.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../src/payment/entities/payment.entity';
import { PaymentStatus } from '../src/payment/enums/payment-status.enum';
import { ApiCredential } from '../src/auth/entities/api-credential.entity';

describe('PaymentModule (e2e)', () => {
  let app: INestApplication;
  let merchantRepository: Repository<Merchant>;
  let paymentRepository: Repository<Payment>;
  let apiCredentialService: ApiCredentialService;
  
  let merchantAId: string;
  let secretA: string;
  
  let merchantBId: string;
  let secretB: string;

  beforeAll(async () => {
    process.env.ALLOW_DEV_CREDENTIAL_PROVISIONING = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    merchantRepository = moduleFixture.get<Repository<Merchant>>(getRepositoryToken(Merchant));
    paymentRepository = moduleFixture.get<Repository<Payment>>(getRepositoryToken(Payment));
    apiCredentialService = moduleFixture.get<ApiCredentialService>(ApiCredentialService);

    await paymentRepository.query('DELETE FROM payments');
    const apiCredRepo = moduleFixture.get<Repository<ApiCredential>>(getRepositoryToken(ApiCredential));
    await apiCredRepo.query('DELETE FROM api_credentials');
    await merchantRepository.query('DELETE FROM merchants');

    // Create Merchant A
    const mA = await merchantRepository.save(merchantRepository.create({
      name: 'Merchant A', businessName: 'Business A', email: 'a@example.com'
    }));
    merchantAId = mA.id;
    const credA = await apiCredentialService.createCredential(merchantAId);
    secretA = credA.plaintextSecret;

    // Create Merchant B
    const mB = await merchantRepository.save(merchantRepository.create({
      name: 'Merchant B', businessName: 'Business B', email: 'b@example.com'
    }));
    merchantBId = mB.id;
    const credB = await apiCredentialService.createCredential(merchantBId);
    secretB = credB.plaintextSecret;
  });

  afterAll(async () => {
    await paymentRepository.query('DELETE FROM payments');
    const apiCredRepo = app.get<Repository<ApiCredential>>(getRepositoryToken(ApiCredential));
    await apiCredRepo.query('DELETE FROM api_credentials');
    await merchantRepository.query('DELETE FROM merchants');
    await app.close();
  });

  describe('Payment API flows', () => {
    let paymentAId: string;

    it('POST /api/v1/payments (Unauthenticated) should fail 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ amount: 10000, currency: 'IDR', orderId: 'ORD-1' })
        .expect(401);
    });

    it('POST /api/v1/payments should create a payment for Merchant A', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .send({ amount: 10000, currency: 'IDR', orderId: 'ORD-1' })
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe(PaymentStatus.PENDING);
      expect(response.body.data.amount).toBe(10000);
      
      paymentAId = response.body.data.id;
    });

    it('POST /api/v1/payments should fail 409 for duplicate orderId in same merchant', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .send({ amount: 5000, currency: 'IDR', orderId: 'ORD-1' })
        .expect(409);
    });

    it('POST /api/v1/payments should succeed for same orderId but different merchant', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretB}`)
        .send({ amount: 5000, currency: 'IDR', orderId: 'ORD-1' })
        .expect(201);
      
      expect(response.body.status).toBe('success');
    });

    it('GET /api/v1/payments/:id should retrieve own payment', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentAId}`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      expect(response.body.data.id).toBe(paymentAId);
    });

    it('GET /api/v1/payments/:id should fail 404 for cross-merchant retrieval', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentAId}`)
        .set('Authorization', `Bearer ${secretB}`)
        .expect(404);
    });

    it('GET /api/v1/payments should list own payments only', async () => {
      const responseA = await request(app.getHttpServer())
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);
      
      expect(responseA.body.data).toHaveLength(1);
      expect(responseA.body.data[0].id).toBe(paymentAId);
    });

    it('POST /api/v1/internal/payments/:id/transition should transition status', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/internal/payments/${paymentAId}/transition`)
        .set('Authorization', `Bearer ${secretA}`)
        .send({ status: PaymentStatus.SUCCEEDED })
        .expect(201);
      
      expect(response.body.data.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('POST /api/v1/internal/payments/:id/transition should fail 400 when transitioning from terminal state', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/internal/payments/${paymentAId}/transition`)
        .set('Authorization', `Bearer ${secretA}`)
        .send({ status: PaymentStatus.CANCELLED })
        .expect(400);
    });

    it('POST /api/v1/internal/payments/:id/transition should fail 404 for cross-merchant transition', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/internal/payments/${paymentAId}/transition`)
        .set('Authorization', `Bearer ${secretB}`)
        .send({ status: PaymentStatus.FAILED })
        .expect(404);
    });
  });
});
