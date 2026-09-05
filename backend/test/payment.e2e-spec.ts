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
    const apiCredRepo = moduleFixture.get<Repository<ApiCredential>>(
      getRepositoryToken(ApiCredential),
    );
    await apiCredRepo.query('DELETE FROM idempotency_keys');
    await apiCredRepo.query('DELETE FROM api_credentials');
    await merchantRepository.query('DELETE FROM merchants');

    // Create Merchant A
    const mA = await merchantRepository.save(
      merchantRepository.create({
        name: 'Merchant A',
        businessName: 'Business A',
        email: 'a@example.com',
      }),
    );
    merchantAId = mA.id;
    const credA = await apiCredentialService.createCredential(merchantAId);
    secretA = credA.plaintextSecret;

    // Create Merchant B
    const mB = await merchantRepository.save(
      merchantRepository.create({
        name: 'Merchant B',
        businessName: 'Business B',
        email: 'b@example.com',
      }),
    );
    merchantBId = mB.id;
    const credB = await apiCredentialService.createCredential(merchantBId);
    secretB = credB.plaintextSecret;
  });

  afterAll(async () => {
    await paymentRepository.query('DELETE FROM payments');
    const apiCredRepo = app.get<Repository<ApiCredential>>(getRepositoryToken(ApiCredential));
    await apiCredRepo.query('DELETE FROM idempotency_keys');
    await apiCredRepo.query('DELETE FROM api_credentials');
    await merchantRepository.query('DELETE FROM merchants');
    await app.close();
  });

  describe('Payment API flows', () => {
    let paymentAId: string;

    it('POST /api/v1/payments (Unauthenticated) should fail 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Idempotency-Key', 'fail-401')
        .send({ amount: 10000, currency: 'IDR', orderId: 'ORD-1' })
        .expect(401);
    });

    it('POST /api/v1/payments should create a payment for Merchant A', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'create-a')
        .send({
          amount: 250000,
          currency: 'IDR',
          orderId: 'ORD-001',
          paymentMethod: 'QRIS',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.orderId).toBe('ORD-001');
      expect(response.body.data.paymentMethod).toBe('QRIS');
      paymentAId = response.body.data.id;
    });

    it('should fail 400 for invalid payment method', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'invalid-method')
        .send({
          amount: 250000,
          currency: 'IDR',
          orderId: 'ORD-INV',
          paymentMethod: 'INVALID_METHOD',
        });

      expect(response.status).toBe(400);
    });

    it('should fail 409 for duplicate orderId in same merchant', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'dup-orderid')
        .send({
          amount: 50000,
          currency: 'IDR',
          orderId: 'ORD-001',
          paymentMethod: 'QRIS',
        });

      expect(response.status).toBe(409);
    });

    it('should succeed for same orderId but different merchant', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretB}`)
        .set('Idempotency-Key', 'same-orderid-b')
        .send({
          amount: 50000,
          currency: 'IDR',
          orderId: 'ORD-001',
          paymentMethod: 'CARD',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.paymentMethod).toBe('CARD');
    });

    it('should process payment to SUCCEEDED', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentAId}/process`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'process-success')
        .send();

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('SUCCEEDED');
      expect(response.body.data.providerReference).toBeDefined();
    });

    it('should simulate failure when description contains SIMULATE_FAILURE', async () => {
      // Create new payment for failure
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'create-fail-sim')
        .send({
          amount: 10000,
          currency: 'IDR',
          orderId: 'ORD-FAIL',
          description: 'SIMULATE_FAILURE',
          paymentMethod: 'EWALLET',
        });

      const failPaymentId = createRes.body.data.id;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/${failPaymentId}/process`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'process-fail-sim')
        .send();

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('FAILED');
      expect(response.body.data.providerReference).toBeDefined();
    });

    it('should reject processing a terminal state payment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentAId}/process`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'process-terminal-state')
        .send();

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Cannot process payment in status');
    });

    it('should simulate system error as 500 but leave payment PENDING', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'create-sys-err')
        .send({
          amount: 10000,
          currency: 'IDR',
          orderId: 'ORD-ERR',
          description: 'SIMULATE_SYSTEM_ERROR',
          paymentMethod: 'VIRTUAL_ACCOUNT',
        });

      const errPaymentId = createRes.body.data.id;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/${errPaymentId}/process`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'process-sys-err')
        .send();

      expect(response.status).toBe(500);

      // Verify still pending
      const checkRes = await request(app.getHttpServer())
        .get(`/api/v1/payments/${errPaymentId}`)
        .set('Authorization', `Bearer ${secretA}`)
        .send();

      expect(checkRes.body.data.status).toBe('PENDING');
    });

    it('should fail 404 for cross-merchant process', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentAId}/process`)
        .set('Authorization', `Bearer ${secretB}`)
        .set('Idempotency-Key', 'process-cross')
        .send();

      expect(response.status).toBe(404);
    });

    it('should fail 401 for unauthenticated process', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentAId}/process`)
        .set('Idempotency-Key', 'process-unauth')
        .send();

      expect(response.status).toBe(401);
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
      const response = await request(app.getHttpServer())
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].merchantId).toBe(merchantAId);
    });

    it('POST /api/v1/internal/payments/:id/transition should transition status', async () => {
      // Create a new payment to transition since paymentA is already SUCCEEDED
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'create-trans')
        .send({
          amount: 5000,
          currency: 'IDR',
          orderId: 'ORD-TRANS',
          paymentMethod: 'QRIS',
        });
      const transPaymentId = createRes.body.data.id;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/internal/payments/${transPaymentId}/transition`)
        .set('Authorization', `Bearer ${secretA}`)
        .send({ status: 'FAILED' });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('FAILED');
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

  describe('Idempotency API flows (Phase 6)', () => {
    it('POST /api/v1/payments missing Idempotency-Key should return 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          amount: 10000,
          currency: 'IDR',
          orderId: 'IDEM-ERR1',
          paymentMethod: 'QRIS',
        })
        .expect(400);
    });

    it('should create payment successfully with Idempotency-Key', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'idem-key-1')
        .send({
          amount: 250000,
          currency: 'IDR',
          orderId: 'IDEM-001',
          paymentMethod: 'QRIS',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.orderId).toBe('IDEM-001');
    });

    it('should replay the exact same response for the same Idempotency-Key and payload', async () => {
      // First we get the original result
      const originalRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'idem-key-1')
        .send({
          amount: 250000,
          currency: 'IDR',
          orderId: 'IDEM-001',
          paymentMethod: 'QRIS',
        });

      // Now repeat
      const replayRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'idem-key-1')
        .send({
          amount: 250000,
          currency: 'IDR',
          orderId: 'IDEM-001',
          paymentMethod: 'QRIS',
        });

      expect(replayRes.status).toBe(201);
      expect(replayRes.body.data.id).toBe(originalRes.body.data.id);
    });

    it('should return 409 Conflict if payload changes for the same Idempotency-Key', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'idem-key-1')
        .send({
          amount: 350000, // Different payload
          currency: 'IDR',
          orderId: 'IDEM-001',
          paymentMethod: 'QRIS',
        });

      expect(response.status).toBe(409);
    });

    it('should allow the same Idempotency-Key for a different merchant', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretB}`) // Merchant B
        .set('Idempotency-Key', 'idem-key-1') // Same Key
        .send({
          amount: 50000,
          currency: 'IDR',
          orderId: 'IDEM-002',
          paymentMethod: 'CARD',
        });

      expect(response.status).toBe(201);
    });

    it('should handle exactly one creation in concurrent identical requests', async () => {
      const payload = {
        amount: 80000,
        currency: 'IDR',
        orderId: 'IDEM-CONCUR',
        paymentMethod: 'QRIS',
      };
      const key = 'concurrent-key-1';

      // Fire 5 identical requests concurrently
      const promises = Array.from({ length: 5 }).map(() =>
        request(app.getHttpServer())
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${secretA}`)
          .set('Idempotency-Key', key)
          .send(payload),
      );

      const responses = await Promise.all(promises);

      // Verify all resolved to exactly the same payment ID, or at least 201s with same IDs
      const successResponses = responses.filter(r => r.status === 201);
      
      expect(successResponses.length).toBeGreaterThan(0);
      
      const firstId = successResponses[0].body.data.id;
      for (const res of successResponses) {
        expect(res.body.data.id).toBe(firstId);
      }

      // Verify only 1 payment was actually created in DB
      const dbCount = await paymentRepository.count({
        where: { orderId: 'IDEM-CONCUR' },
      });
      expect(dbCount).toBe(1);
    });

    it('should process payment idempotently', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'idem-process-create')
        .send({
          amount: 10000,
          currency: 'IDR',
          orderId: 'IDEM-PROCESS',
          paymentMethod: 'QRIS',
        });

      const paymentId = createRes.body.data.id;

      const promises = Array.from({ length: 3 }).map(() =>
        request(app.getHttpServer())
          .post(`/api/v1/payments/${paymentId}/process`)
          .set('Authorization', `Bearer ${secretA}`)
          .set('Idempotency-Key', 'idem-process-action')
          .send(),
      );

      const responses = await Promise.all(promises);
      const successResponses = responses.filter(r => r.status === 201);
      
      expect(successResponses.length).toBeGreaterThan(0);
      const firstStatus = successResponses[0].body.data.status;
      expect(firstStatus).toBe('SUCCEEDED');
      
      for (const res of successResponses) {
         expect(res.body.data.status).toBe('SUCCEEDED');
      }
    });
  });
});
