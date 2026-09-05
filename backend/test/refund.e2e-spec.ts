import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as http from 'http';
import { AddressInfo } from 'net';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { Merchant } from '../src/merchant/entities/merchant.entity';
import { ApiCredentialService } from '../src/auth/services/api-credential.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../src/payment/entities/payment.entity';
import { PaymentStatus } from '../src/payment/enums/payment-status.enum';
import { PaymentMethodType } from '../src/payment/enums/payment-method.enum';
import { Refund } from '../src/refund/entities/refund.entity';
import { RefundStatus } from '../src/refund/enums/refund-status.enum';
import { MerchantWebhookConfig } from '../src/webhook/entities/webhook-config.entity';
import { WebhookEvent } from '../src/webhook/entities/webhook-event.entity';
import { WebhookDelivery } from '../src/webhook/entities/webhook-delivery.entity';
import { IdempotencyKey } from '../src/payment/entities/idempotency-key.entity';
import * as crypto from 'crypto';

describe('RefundModule (e2e)', () => {
  let app: INestApplication;
  let merchantRepo: Repository<Merchant>;
  let paymentRepo: Repository<Payment>;
  let refundRepo: Repository<Refund>;
  let configRepo: Repository<MerchantWebhookConfig>;
  let eventRepo: Repository<WebhookEvent>;
  let deliveryRepo: Repository<WebhookDelivery>;
  let idempotencyRepo: Repository<IdempotencyKey>;
  let apiCredentialService: ApiCredentialService;

  let merchantAId: string;
  let secretA: string;

  let merchantBId: string;
  let secretB: string;

  // Mock HTTP Receiver for webhook verification
  let receiverServer: http.Server;
  let receiverPort: number;
  let receivedEvents: any[] = [];
  let receiverStatusCode = 200;

  beforeAll(async () => {
    process.env.ALLOW_DEV_CREDENTIAL_PROVISIONING = 'true';
    process.env.ALLOW_DEV_PAYMENT_SIMULATION = 'true';
    process.env.ALLOW_DEV_WEBHOOK_DELIVERY = 'true';
    process.env.ALLOW_DEV_LOCAL_WEBHOOKS = 'true';

    // Start mock receiver server
    receiverServer = http.createServer((req, res) => {
      let bodyStr = '';
      req.on('data', (chunk) => {
        bodyStr += chunk.toString();
      });
      req.on('end', () => {
        let parsedBody = null;
        try {
          parsedBody = JSON.parse(bodyStr);
          receivedEvents.push(parsedBody);
        } catch {
          // ignore parse error
        }
        res.writeHead(receiverStatusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      });
    });

    await new Promise<void>((resolve) => {
      receiverServer.listen(0, '127.0.0.1', () => {
        const addr = receiverServer.address() as AddressInfo;
        receiverPort = addr.port;
        resolve();
      });
    });

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

    merchantRepo = moduleFixture.get<Repository<Merchant>>(getRepositoryToken(Merchant));
    paymentRepo = moduleFixture.get<Repository<Payment>>(getRepositoryToken(Payment));
    refundRepo = moduleFixture.get<Repository<Refund>>(getRepositoryToken(Refund));
    configRepo = moduleFixture.get<Repository<MerchantWebhookConfig>>(
      getRepositoryToken(MerchantWebhookConfig),
    );
    eventRepo = moduleFixture.get<Repository<WebhookEvent>>(getRepositoryToken(WebhookEvent));
    deliveryRepo = moduleFixture.get<Repository<WebhookDelivery>>(
      getRepositoryToken(WebhookDelivery),
    );
    idempotencyRepo = moduleFixture.get<Repository<IdempotencyKey>>(
      getRepositoryToken(IdempotencyKey),
    );
    apiCredentialService = moduleFixture.get<ApiCredentialService>(ApiCredentialService);

    // Clean up database tables in order
    await deliveryRepo.query('DELETE FROM webhook_deliveries');
    await eventRepo.query('DELETE FROM webhook_events');
    await configRepo.query('DELETE FROM merchant_webhook_configs');
    await refundRepo.query('DELETE FROM refunds');
    await paymentRepo.query('DELETE FROM payments');
    await idempotencyRepo.query('DELETE FROM idempotency_keys');
    await merchantRepo.query('DELETE FROM api_credentials');
    await merchantRepo.query('DELETE FROM merchants');

    // Create Merchant A
    const mA = await merchantRepo.save(
      merchantRepo.create({
        name: 'Merchant A',
        businessName: 'Business A',
        email: 'merch_a_refund@example.com',
      }),
    );
    merchantAId = mA.id;
    const credA = await apiCredentialService.createCredential(merchantAId);
    secretA = credA.plaintextSecret;

    // Create Merchant B
    const mB = await merchantRepo.save(
      merchantRepo.create({
        name: 'Merchant B',
        businessName: 'Business B',
        email: 'merch_b_refund@example.com',
      }),
    );
    merchantBId = mB.id;
    const credB = await apiCredentialService.createCredential(merchantBId);
    secretB = credB.plaintextSecret;

    // Configure Webhook endpoint for Merchant A
    await request(app.getHttpServer())
      .post('/api/v1/webhook-configs')
      .set('Authorization', `Bearer ${secretA}`)
      .send({
        endpointUrl: `http://127.0.0.1:${receiverPort}/webhook`,
      })
      .expect(201);
  });

  afterAll(async () => {
    if (receiverServer) {
      receiverServer.close();
    }
    await app.close();
  });

  beforeEach(() => {
    receivedEvents = [];
    receiverStatusCode = 200;
  });

  // Helper to create and process a payment
  async function createTestPayment(
    amount: number = 100000,
    secret: string = secretA,
    autoProcess: boolean = true,
  ): Promise<any> {
    const orderId = `ord_${crypto.randomUUID().substring(0, 8)}`;
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${secret}`)
      .set('Idempotency-Key', `idem_create_${orderId}`)
      .send({
        amount,
        currency: 'IDR',
        orderId,
        paymentMethod: PaymentMethodType.QRIS,
      })
      .expect(201);

    const payment = createRes.body.data;

    if (autoProcess) {
      const procRes = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/process`)
        .set('Authorization', `Bearer ${secret}`)
        .set('Idempotency-Key', `idem_proc_${orderId}`)
        .expect(201);
      return procRes.body.data;
    }

    return payment;
  }

  describe('1. Refund Eligibility', () => {
    it('should reject refund when payment is in PENDING status', async () => {
      const payment = await createTestPayment(100000, secretA, false);
      expect(payment.status).toBe(PaymentStatus.PENDING);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_elig_pending_${payment.id}`)
        .send({ amount: 50000, reason: 'Customer refund' })
        .expect(400);

      expect(res.body.message).toContain('Payment is not eligible for refund');
    });

    it('should reject refund when payment is in FAILED status', async () => {
      // Create payment with SIMULATE_FAILURE description so processPayment sets status to FAILED
      const orderId = `ord_fail_${crypto.randomUUID().substring(0, 8)}`;
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_create_${orderId}`)
        .send({
          amount: 100000,
          currency: 'IDR',
          orderId,
          description: 'SIMULATE_FAILURE',
          paymentMethod: PaymentMethodType.QRIS,
        })
        .expect(201);

      const payment = createRes.body.data;
      const procRes = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/process`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_proc_${orderId}`)
        .expect(201);

      expect(procRes.body.data.status).toBe(PaymentStatus.FAILED);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_elig_failed_${payment.id}`)
        .send({ amount: 50000 })
        .expect(400);

      expect(res.body.message).toContain('Payment is not eligible for refund');
    });

    it('should allow refund when payment is in SUCCEEDED status', async () => {
      const payment = await createTestPayment(100000, secretA, true);
      expect(payment.status).toBe(PaymentStatus.SUCCEEDED);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_elig_succ_${payment.id}`)
        .send({ amount: 50000, reason: 'Customer return' })
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe(RefundStatus.SUCCESS);
      expect(res.body.data.amount).toBe(50000);
      expect(res.body.data.currency).toBe('IDR');
      expect(res.body.data.providerReference).toMatch(/^ref_sim_/);
    });
  });

  describe('2. Full & Partial Refunds and Over-Refund Rejection', () => {
    it('should support full refund and reject a second full refund', async () => {
      const payment = await createTestPayment(100000, secretA, true);

      // Full refund (100,000 IDR)
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_full_1_${payment.id}`)
        .send({ amount: 100000, reason: 'Full refund' })
        .expect(201);

      expect(res1.body.data.status).toBe(RefundStatus.SUCCESS);
      expect(res1.body.data.amount).toBe(100000);

      // Second refund attempt should fail because remaining refundable balance is 0
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_full_2_${payment.id}`)
        .send({ amount: 100000 })
        .expect(400);

      expect(res2.body.message).toContain('exceeds remaining refundable balance');
    });

    it('should support multiple partial refunds up to the exact payment amount', async () => {
      const payment = await createTestPayment(100000, secretA, true);

      // Refund 1: 30,000 (Remaining: 70,000)
      const r1 = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_part_1_${payment.id}`)
        .send({ amount: 30000 })
        .expect(201);
      expect(r1.body.data.amount).toBe(30000);

      // Refund 2: 20,000 (Remaining: 50,000)
      const r2 = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_part_2_${payment.id}`)
        .send({ amount: 20000 })
        .expect(201);
      expect(r2.body.data.amount).toBe(20000);

      // Refund 3: 60,000 (Exceeds remaining 50,000 -> REJECTED)
      const r3 = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_part_3_${payment.id}`)
        .send({ amount: 60000 })
        .expect(400);
      expect(r3.body.message).toContain('exceeds remaining refundable balance');

      // Refund 4: Exact remaining 50,000 -> SUCCEEDS
      const r4 = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_part_4_${payment.id}`)
        .send({ amount: 50000 })
        .expect(201);
      expect(r4.body.data.amount).toBe(50000);

      // Total refunded is now exactly 100,000. Any further refund of 1 fails.
      const r5 = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_part_5_${payment.id}`)
        .send({ amount: 1 })
        .expect(400);
      expect(r5.body.message).toContain('exceeds remaining refundable balance');
    });

    it('should reject invalid amounts (zero, negative, non-integer)', async () => {
      const payment = await createTestPayment(100000, secretA, true);

      // Zero
      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_invalid_zero_${payment.id}`)
        .send({ amount: 0 })
        .expect(400);

      // Negative
      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_invalid_neg_${payment.id}`)
        .send({ amount: -100 })
        .expect(400);

      // Non-integer (floating point)
      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_invalid_float_${payment.id}`)
        .send({ amount: 500.5 })
        .expect(400);
    });
  });

  describe('3. Refund Idempotency', () => {
    it('should return cached 201 response when same key and same payload are provided', async () => {
      const payment = await createTestPayment(100000, secretA, true);
      const idemKey = `idem_exact_replay_${payment.id}`;

      // First call
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: 40000, reason: 'Replay test' })
        .expect(201);

      const refund1Id = res1.body.data.id;

      // Replay call with exact same key and body
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: 40000, reason: 'Replay test' })
        .expect(201);

      expect(res2.body.data.id).toBe(refund1Id);
      expect(res2.body.data.amount).toBe(40000);

      // Verify that in the database, exactly ONE refund was created
      const refunds = await refundRepo.find({ where: { paymentId: payment.id } });
      expect(refunds).toHaveLength(1);
    });

    it('should return 409 Conflict when same key is used with a different request payload', async () => {
      const payment = await createTestPayment(100000, secretA, true);
      const idemKey = `idem_conflict_test_${payment.id}`;

      // Initial request with 30,000
      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: 30000, reason: 'Payload A' })
        .expect(201);

      // Conflicting request with same key but 40,000
      const conflictRes = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: 40000, reason: 'Payload B' })
        .expect(409);

      expect(conflictRes.body.message).toContain(
        'Idempotency key used with a different request payload',
      );
    });

    it('should allow different merchants to use the same idempotency key independently', async () => {
      const paymentA = await createTestPayment(100000, secretA, true);
      const paymentB = await createTestPayment(100000, secretB, true);

      const sharedKey = `shared_merchant_key_${crypto.randomUUID()}`;

      // Merchant A uses key
      const resA = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentA.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', sharedKey)
        .send({ amount: 25000 })
        .expect(201);

      // Merchant B uses identical key
      const resB = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentB.id}/refunds`)
        .set('Authorization', `Bearer ${secretB}`)
        .set('Idempotency-Key', sharedKey)
        .send({ amount: 35000 })
        .expect(201);

      expect(resA.body.data.id).not.toBe(resB.body.data.id);
      expect(resA.body.data.amount).toBe(25000);
      expect(resB.body.data.amount).toBe(35000);
    });
  });

  describe('4. Merchant Isolation', () => {
    it('should prevent Merchant B from refunding Merchant A payment', async () => {
      const paymentA = await createTestPayment(100000, secretA, true);

      // Merchant B attempts to refund Payment A
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentA.id}/refunds`)
        .set('Authorization', `Bearer ${secretB}`)
        .set('Idempotency-Key', `idem_cross_${paymentA.id}`)
        .send({ amount: 10000 })
        .expect(404);

      expect(res.body.message).toContain('Payment not found');
    });

    it('should prevent Merchant B from viewing Merchant A refunds', async () => {
      const paymentA = await createTestPayment(100000, secretA, true);

      // Merchant A creates refund
      const refundRes = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentA.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_view_a_${paymentA.id}`)
        .send({ amount: 15000 })
        .expect(201);

      const refundId = refundRes.body.data.id;

      // Merchant B tries to fetch Payment A's refunds
      await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentA.id}/refunds`)
        .set('Authorization', `Bearer ${secretB}`)
        .expect(404);

      // Merchant B tries to fetch specific Refund by ID
      await request(app.getHttpServer())
        .get(`/api/v1/refunds/${refundId}`)
        .set('Authorization', `Bearer ${secretB}`)
        .expect(404);

      // Merchant A can fetch successfully
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/refunds/${refundId}`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      expect(getRes.body.data.id).toBe(refundId);
    });
  });

  describe('5. Provider Simulator Behavior (Success, Failure, System Error)', () => {
    it('should set status to FAILED when SIMULATE_FAILURE is triggered and release balance', async () => {
      const payment = await createTestPayment(100000, secretA, true);

      // Refund with SIMULATE_FAILURE
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_fail_sim_${payment.id}`)
        .send({ amount: 50000, reason: 'SIMULATE_FAILURE' })
        .expect(201);

      expect(res.body.data.status).toBe(RefundStatus.FAILED);
      expect(res.body.data.providerReference).toMatch(/^ref_sim_fail_/);

      // Crucial: The failed refund did NOT consume the balance.
      // So merchant can still refund the full 100,000!
      const retryRes = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_retry_after_fail_${payment.id}`)
        .send({ amount: 100000, reason: 'Full retry' })
        .expect(201);

      expect(retryRes.body.data.status).toBe(RefundStatus.SUCCESS);
      expect(retryRes.body.data.amount).toBe(100000);
    });

    it('should rollback transaction and return 500 when SIMULATE_SYSTEM_ERROR is triggered', async () => {
      const payment = await createTestPayment(100000, secretA, true);

      // Refund with SIMULATE_SYSTEM_ERROR
      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_syserr_${payment.id}`)
        .send({ amount: 50000, reason: 'SIMULATE_SYSTEM_ERROR' })
        .expect(500);

      // Verify no refund record committed in database
      const refunds = await refundRepo.find({ where: { paymentId: payment.id } });
      expect(refunds).toHaveLength(0);
    });
  });

  describe('6. Webhook Integration & Resiliency', () => {
    it('should create and deliver refund.created and refund.succeeded webhook events', async () => {
      const payment = await createTestPayment(100000, secretA, true);

      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_webhook_test_${payment.id}`)
        .send({ amount: 20000, reason: 'Webhook verification' })
        .expect(201);

      // Wait 150ms for asynchronous webhook dispatch
      await new Promise((resolve) => setTimeout(resolve, 150));

      const refundEvents = receivedEvents.filter((e) => e.data?.refund?.payment_id === payment.id);

      expect(refundEvents.length).toBeGreaterThanOrEqual(2);
      const eventTypes = refundEvents.map((e) => e.type);
      expect(eventTypes).toContain('refund.created');
      expect(eventTypes).toContain('refund.succeeded');
    });

    it('should NOT rollback refund if webhook delivery endpoint returns HTTP 500', async () => {
      receiverStatusCode = 500; // Mock receiver fails!
      const payment = await createTestPayment(100000, secretA, true);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_webhook_fail_${payment.id}`)
        .send({ amount: 25000, reason: 'Receiver 500 test' })
        .expect(201);

      expect(res.body.data.status).toBe(RefundStatus.SUCCESS);

      // Verify in database that refund was permanently committed
      const refund = await refundRepo.findOne({ where: { id: res.body.data.id } });
      expect(refund).not.toBeNull();
      expect(refund!.status).toBe(RefundStatus.SUCCESS);
    });
  });

  describe('7. Concurrency Test (Section 23 - Mandatory)', () => {
    it('should strictly prevent over-refunding under parallel concurrent refund requests', async () => {
      // Payment: 100,000 IDR
      const payment = await createTestPayment(100000, secretA, true);

      // Launch 2 genuinely concurrent requests for 70,000 IDR each
      // Total requested = 140,000 IDR (exceeds 100,000 IDR)
      const req1 = request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_concurrent_1_${payment.id}`)
        .send({ amount: 70000, reason: 'Concurrent request 1' });

      const req2 = request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_concurrent_2_${payment.id}`)
        .send({ amount: 70000, reason: 'Concurrent request 2' });

      const [res1, res2] = await Promise.all([req1, req2]);

      const responses = [res1, res2];
      const successResponses = responses.filter((r) => r.status === 201);
      const rejectedResponses = responses.filter((r) => r.status === 400);

      // Invariant checks:
      // Exactly ONE must succeed (201) and exactly ONE must fail (400)
      expect(successResponses).toHaveLength(1);
      expect(rejectedResponses).toHaveLength(1);
      expect(rejectedResponses[0].body.message).toContain('exceeds remaining refundable balance');

      // Database verification:
      const refunds = await refundRepo.find({ where: { paymentId: payment.id } });
      expect(refunds).toHaveLength(1);
      expect(refunds[0].amount).toBe(70000);
      expect(refunds[0].status).toBe(RefundStatus.SUCCESS);

      // Calculate final refundable balance:
      const totalRefunded = refunds.reduce((sum, r) => sum + r.amount, 0);
      const finalRemainingBalance = payment.amount - totalRefunded;

      expect(totalRefunded).toBe(70000);
      expect(totalRefunded).toBeLessThanOrEqual(payment.amount);
      expect(finalRemainingBalance).toBe(30000);
      expect(finalRemainingBalance).toBeGreaterThanOrEqual(0);
    });

    it('should handle multi-thread competition: 5 concurrent requests of 30,000 on 100,000 payment', async () => {
      // Payment: 100,000 IDR
      // 5 concurrent requests of 30,000 IDR = 150,000 IDR requested
      // Expected: Exactly 3 succeed (3 * 30,000 = 90,000 IDR), exactly 2 fail (remaining 10,000 < 30,000)
      const payment = await createTestPayment(100000, secretA, true);

      const promises = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post(`/api/v1/payments/${payment.id}/refunds`)
          .set('Authorization', `Bearer ${secretA}`)
          .set('Idempotency-Key', `idem_stress_${i}_${payment.id}`)
          .send({ amount: 30000, reason: `Stress test request ${i}` }),
      );

      const results = await Promise.all(promises);

      const successes = results.filter((r) => r.status === 201);
      const failures = results.filter((r) => r.status === 400);

      expect(successes).toHaveLength(3);
      expect(failures).toHaveLength(2);

      const committedRefunds = await refundRepo.find({ where: { paymentId: payment.id } });
      expect(committedRefunds).toHaveLength(3);

      const totalCommitted = committedRefunds.reduce((sum, r) => sum + r.amount, 0);
      expect(totalCommitted).toBe(90000);
      expect(totalCommitted).toBeLessThanOrEqual(100000);
    });
  });
});
