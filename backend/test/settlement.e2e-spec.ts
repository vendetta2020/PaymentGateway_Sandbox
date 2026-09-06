import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository, DataSource } from 'typeorm';
import { Merchant } from '../src/merchant/entities/merchant.entity';
import { ApiCredentialService } from '../src/auth/services/api-credential.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../src/payment/entities/payment.entity';
import { PaymentMethodType } from '../src/payment/enums/payment-method.enum';
import { Refund } from '../src/refund/entities/refund.entity';
import { Settlement } from '../src/settlement/entities/settlement.entity';
import { SettlementStatus } from '../src/settlement/enums/settlement-status.enum';
import * as crypto from 'crypto';

describe('SettlementModule (e2e)', () => {
  let app: INestApplication;
  let merchantRepo: Repository<Merchant>;
  let paymentRepo: Repository<Payment>;
  let refundRepo: Repository<Refund>;
  let settlementRepo: Repository<Settlement>;
  let apiCredentialService: ApiCredentialService;

  let merchantAId: string;
  let secretA: string;

  let merchantBId: string;
  let secretB: string;

  beforeAll(async () => {
    process.env.ALLOW_DEV_CREDENTIAL_PROVISIONING = 'true';
    process.env.ALLOW_DEV_PAYMENT_SIMULATION = 'true';

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

    merchantRepo = moduleFixture.get(getRepositoryToken(Merchant));
    paymentRepo = moduleFixture.get(getRepositoryToken(Payment));
    refundRepo = moduleFixture.get(getRepositoryToken(Refund));
    settlementRepo = moduleFixture.get(getRepositoryToken(Settlement));
    apiCredentialService = moduleFixture.get(ApiCredentialService);

    // Initial database cleanup
    await settlementRepo.query('DELETE FROM reconciliation_results');
    await settlementRepo.query('DELETE FROM reconciliation_runs');
    await settlementRepo.query('DELETE FROM settlements');
    await refundRepo.query('DELETE FROM refunds');
    await paymentRepo.query('DELETE FROM payments');
    await merchantRepo.query('DELETE FROM idempotency_keys');
    await merchantRepo.query('DELETE FROM api_credentials');
    await merchantRepo.query('DELETE FROM merchants');

    // Create Merchant A
    const mA = await merchantRepo.save(
      merchantRepo.create({
        name: 'Settlement Merchant A',
        businessName: 'Business A',
        email: 'settle_a@example.com',
      }),
    );
    merchantAId = mA.id;
    const credA = await apiCredentialService.createCredential(merchantAId);
    secretA = credA.plaintextSecret;

    // Create Merchant B
    const mB = await merchantRepo.save(
      merchantRepo.create({
        name: 'Settlement Merchant B',
        businessName: 'Business B',
        email: 'settle_b@example.com',
      }),
    );
    merchantBId = mB.id;
    const credB = await apiCredentialService.createCredential(merchantBId);
    secretB = credB.plaintextSecret;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Settlement Calculation & Lifecycle', () => {
    it('should calculate gross amount from SUCCEEDED payments and deduct SUCCESS refunds', async () => {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 3600000).toISOString();
      const periodEnd = new Date(now.getTime() + 3600000).toISOString();

      // 1. Create a SUCCEEDED payment of 100,000 IDR
      const pay1Res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_stl_p1_${crypto.randomUUID()}`)
        .send({
          amount: 100000,
          currency: 'IDR',
          orderId: `ord_stl_1_${crypto.randomUUID().substring(0, 6)}`,
          paymentMethod: PaymentMethodType.QRIS,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/payments/${pay1Res.body.data.id}/process`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_stl_proc1_${crypto.randomUUID()}`)
        .expect(201);

      // 2. Create another SUCCEEDED payment of 50,000 IDR
      const pay2Res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_stl_p2_${crypto.randomUUID()}`)
        .send({
          amount: 50000,
          currency: 'IDR',
          orderId: `ord_stl_2_${crypto.randomUUID().substring(0, 6)}`,
          paymentMethod: PaymentMethodType.QRIS,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/payments/${pay2Res.body.data.id}/process`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_stl_proc2_${crypto.randomUUID()}`)
        .expect(201);

      // 3. Create a PENDING payment (should NOT be counted in gross amount)
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_stl_p3_${crypto.randomUUID()}`)
        .send({
          amount: 20000,
          currency: 'IDR',
          orderId: `ord_stl_3_${crypto.randomUUID().substring(0, 6)}`,
          paymentMethod: PaymentMethodType.QRIS,
        })
        .expect(201);

      // 4. Create a SUCCESS refund of 30,000 IDR against payment 1
      await request(app.getHttpServer())
        .post(`/api/v1/payments/${pay1Res.body.data.id}/refunds`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', `idem_stl_ref1_${crypto.randomUUID()}`)
        .send({ amount: 30000, reason: 'Settlement test refund' })
        .expect(201);

      // 5. Generate settlement for the period
      const stlRes = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart,
          periodEnd,
          currency: 'IDR',
        })
        .expect(201);

      const stl = stlRes.body.data;
      expect(stl.grossAmount).toBe(150000); // 100k + 50k (pending 20k excluded)
      expect(stl.refundAmount).toBe(30000); // 30k refund deducted
      expect(stl.netAmount).toBe(120000); // 150k - 30k = 120k
      expect(stl.status).toBe(SettlementStatus.PENDING);
      expect(stl.settlementReference).toMatch(/^stl_/);

      // 6. Test settlement idempotency: repeating the request returns identical settlement
      const replayRes = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart,
          periodEnd,
          currency: 'IDR',
        })
        .expect(201);

      expect(replayRes.body.data.id).toBe(stl.id);
      expect(replayRes.body.data.settlementReference).toBe(stl.settlementReference);

      // 7. Transition status to PROCESSING, then to SETTLED
      const trans1 = await request(app.getHttpServer())
        .post(`/api/v1/settlements/${stl.id}/transition`)
        .set('Authorization', `Bearer ${secretA}`)
        .send({ status: SettlementStatus.PROCESSING })
        .expect(201);
      expect(trans1.body.data.status).toBe(SettlementStatus.PROCESSING);

      const trans2 = await request(app.getHttpServer())
        .post(`/api/v1/settlements/${stl.id}/transition`)
        .set('Authorization', `Bearer ${secretA}`)
        .send({ status: SettlementStatus.SETTLED })
        .expect(201);
      expect(trans2.body.data.status).toBe(SettlementStatus.SETTLED);
      expect(trans2.body.data.settledAt).toBeDefined();

      // 8. Verify immutability once SETTLED: attempts to mutate are rejected
      await request(app.getHttpServer())
        .post(`/api/v1/settlements/${stl.id}/transition`)
        .set('Authorization', `Bearer ${secretA}`)
        .send({ status: SettlementStatus.FAILED })
        .expect(400);
    });

    it('should enforce merchant isolation on settlements', async () => {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 1800000).toISOString();
      const periodEnd = new Date(now.getTime() + 1800000).toISOString();

      // Merchant A creates a settlement
      const resA = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('Authorization', `Bearer ${secretA}`)
        .send({ periodStart, periodEnd, currency: 'IDR' })
        .expect(201);

      const stlAId = resA.body.data.id;

      // Merchant B attempts to fetch Merchant A's settlement -> 404
      await request(app.getHttpServer())
        .get(`/api/v1/settlements/${stlAId}`)
        .set('Authorization', `Bearer ${secretB}`)
        .expect(404);

      // Merchant B creates own settlement independently
      const resB = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('Authorization', `Bearer ${secretB}`)
        .send({ periodStart, periodEnd, currency: 'IDR' })
        .expect(201);

      expect(resB.body.data.id).not.toBe(stlAId);
      expect(resB.body.data.merchantId).toBe(merchantBId);
    });

    it('should correctly calculate negative net amount on cross-period refund (DEFECT-001 regression test)', async () => {
      // 1. Create and process a payment for Merchant B
      const payRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretB}`)
        .set('Idempotency-Key', `idem_cpr_p_${crypto.randomUUID()}`)
        .send({
          amount: 100000,
          currency: 'IDR',
          orderId: `ord_cpr_${crypto.randomUUID().substring(0, 6)}`,
          paymentMethod: PaymentMethodType.QRIS,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payRes.body.data.id}/process`)
        .set('Authorization', `Bearer ${secretB}`)
        .set('Idempotency-Key', `idem_cpr_proc_${crypto.randomUUID()}`)
        .expect(201);

      // 2. Move payment's created_at to 48 hours ago (Day 1)
      const ds = app.get(DataSource);
      const pastDate = new Date(Date.now() - 48 * 3600 * 1000);
      await ds.query(`UPDATE payments SET created_at = $1 WHERE id = $2`, [
        pastDate,
        payRes.body.data.id,
      ]);

      // 3. Issue full refund of 100,000 IDR (Day 2)
      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payRes.body.data.id}/refunds`)
        .set('Authorization', `Bearer ${secretB}`)
        .set('Idempotency-Key', `idem_cpr_ref_${crypto.randomUUID()}`)
        .send({ amount: 100000, reason: 'Cross-period refund test' })
        .expect(201);

      // 4. Generate Day 2 settlement (period covering only the last 1 hour)
      const day2Start = new Date(Date.now() - 3600 * 1000).toISOString();
      const day2End = new Date(Date.now() + 3600 * 1000).toISOString();

      const stlRes = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('Authorization', `Bearer ${secretB}`)
        .send({
          periodStart: day2Start,
          periodEnd: day2End,
          currency: 'IDR',
        })
        .expect(201);

      const stl = stlRes.body.data;
      expect(stl.grossAmount).toBe(0);
      expect(stl.refundAmount).toBe(100000);
      expect(stl.netAmount).toBe(-100000);
      expect(stl.status).toBe(SettlementStatus.PENDING);
    });
  });

  describe('Concurrency Test (Section 22 - Mandatory)', () => {
    it('should generate exactly ONE settlement record when 10 simultaneous requests are executed', async () => {
      const pStart = new Date('2026-10-01T00:00:00Z').toISOString();
      const pEnd = new Date('2026-10-02T00:00:00Z').toISOString();

      // Launch 10 simultaneous settlement creation requests for the exact same merchant, period, and currency
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/settlements')
          .set('Authorization', `Bearer ${secretA}`)
          .send({
            periodStart: pStart,
            periodEnd: pEnd,
            currency: 'IDR',
          }),
      );

      const responses = await Promise.all(promises);

      // All 10 requests must succeed with HTTP 201
      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      // All 10 responses must return the identical settlement ID
      const firstId = responses[0].body.data.id;
      for (const res of responses) {
        expect(res.body.data.id).toBe(firstId);
      }

      // Check database: exactly ONE record exists for this merchant and period
      const dbSettlements = await settlementRepo.find({
        where: {
          merchantId: merchantAId,
          periodStart: new Date(pStart),
          periodEnd: new Date(pEnd),
          currency: 'IDR',
        },
      });

      expect(dbSettlements).toHaveLength(1);
      expect(dbSettlements[0].id).toBe(firstId);
    });
  });
});
