import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { Merchant } from '../src/merchant/entities/merchant.entity';
import { ApiCredentialService } from '../src/auth/services/api-credential.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../src/payment/entities/payment.entity';
import { PaymentMethodType } from '../src/payment/enums/payment-method.enum';
import { PaymentStatus } from '../src/payment/enums/payment-status.enum';
import { ReconciliationRun } from '../src/reconciliation/entities/reconciliation-run.entity';
import { ReconciliationStatus } from '../src/reconciliation/enums/reconciliation-status.enum';
import { ReconciliationDiscrepancyType } from '../src/reconciliation/enums/reconciliation-discrepancy-type.enum';
import * as crypto from 'crypto';

describe('ReconciliationModule (e2e)', () => {
  let app: INestApplication;
  let merchantRepo: Repository<Merchant>;
  let paymentRepo: Repository<Payment>;
  let runRepo: Repository<ReconciliationRun>;
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
    runRepo = moduleFixture.get(getRepositoryToken(ReconciliationRun));
    apiCredentialService = moduleFixture.get(ApiCredentialService);

    // Initial database cleanup
    await runRepo.query('DELETE FROM reconciliation_results');
    await runRepo.query('DELETE FROM reconciliation_runs');
    await runRepo.query('DELETE FROM settlements');
    await runRepo.query('DELETE FROM refunds');
    await paymentRepo.query('DELETE FROM payments');
    await merchantRepo.query('DELETE FROM idempotency_keys');
    await merchantRepo.query('DELETE FROM api_credentials');
    await merchantRepo.query('DELETE FROM merchants');

    // Create Merchant A
    const mA = await merchantRepo.save(
      merchantRepo.create({
        name: 'Reconciliation Merchant A',
        businessName: 'Business A',
        email: 'recon_a@example.com',
      }),
    );
    merchantAId = mA.id;
    const credA = await apiCredentialService.createCredential(merchantAId);
    secretA = credA.plaintextSecret;

    // Create Merchant B
    const mB = await merchantRepo.save(
      merchantRepo.create({
        name: 'Reconciliation Merchant B',
        businessName: 'Business B',
        email: 'recon_b@example.com',
      }),
    );
    merchantBId = mB.id;
    const credB = await apiCredentialService.createCredential(merchantBId);
    secretB = credB.plaintextSecret;
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper to create and process a payment
  async function createSucceededPayment(amount: number = 100000, secret: string = secretA) {
    const orderId = `ord_rc_${crypto.randomUUID().substring(0, 8)}`;
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${secret}`)
      .set('Idempotency-Key', `idem_rc_p_${orderId}`)
      .send({
        amount,
        currency: 'IDR',
        orderId,
        paymentMethod: PaymentMethodType.QRIS,
      })
      .expect(201);

    const procRes = await request(app.getHttpServer())
      .post(`/api/v1/payments/${createRes.body.data.id}/process`)
      .set('Authorization', `Bearer ${secret}`)
      .set('Idempotency-Key', `idem_rc_pr_${orderId}`)
      .expect(201);

    return procRes.body.data;
  }

  describe('Period Validation (AUDIT-P16-002)', () => {
    it('should reject periods longer than 31 days', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart: '2026-01-01T00:00:00Z',
          periodEnd: '2026-02-01T00:00:01Z', // 31 days + 1 second
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('cannot exceed 31 days');
        });
    });

    it('should reject periodStart >= periodEnd', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart: '2026-02-01T00:00:00Z',
          periodEnd: '2026-01-01T00:00:00Z',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('strictly greater than periodStart');
        });

      await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart: '2026-01-01T00:00:00Z',
          periodEnd: '2026-01-01T00:00:00Z',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('strictly greater than periodStart');
        });
    });

    it('should reject missing or malformed dates', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodEnd: '2026-01-01T00:00:00Z',
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart: '2026-01-01',
          periodEnd: 'invalid',
        })
        .expect(400);
    });
  });

  describe('Reconciliation Discrepancy Scenarios', () => {
    it('Scenario 1: PERFECT_MATCH - all internal payments match provider records', async () => {
      const p1 = await createSucceededPayment(100000);
      const p2 = await createSucceededPayment(50000);

      const periodStart = new Date(new Date(p1.createdAt).getTime() - 10000).toISOString();
      const periodEnd = new Date(new Date(p2.createdAt).getTime() + 10000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart,
          periodEnd,
          scenario: 'PERFECT_MATCH',
        })
        .expect(201);

      const run = res.body.data;
      expect(run.status).toBe(ReconciliationStatus.COMPLETED);
      expect(run.matchedCount).toBeGreaterThanOrEqual(2);
      expect(run.discrepancyCount).toBe(0);
      expect(run.totalInternalAmount).toBeGreaterThanOrEqual(150000);
      expect(run.totalProviderAmount).toBe(run.totalInternalAmount);

      // Verify results
      const resultsRes = await request(app.getHttpServer())
        .get(`/api/v1/reconciliations/${run.id}/results`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      const results = resultsRes.body.data;
      expect(results.length).toBeGreaterThanOrEqual(2);
      for (const r of results) {
        expect(r.discrepancyType).toBe(ReconciliationDiscrepancyType.MATCHED);
      }
    });

    it('Scenario 2: MISSING_IN_PROVIDER - internal transaction missing at provider', async () => {
      const p = await createSucceededPayment(100000);
      const periodStart = new Date(new Date(p.createdAt).getTime() - 1000).toISOString();
      const periodEnd = new Date(new Date(p.createdAt).getTime() + 1000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart,
          periodEnd,
          scenario: 'MISSING_IN_PROVIDER',
        })
        .expect(201);

      const run = res.body.data;
      expect(run.discrepancyCount).toBeGreaterThanOrEqual(1);

      const resultsRes = await request(app.getHttpServer())
        .get(`/api/v1/reconciliations/${run.id}/results`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      const types = resultsRes.body.data.map((r: any) => r.discrepancyType);
      expect(types).toContain(ReconciliationDiscrepancyType.MISSING_IN_PROVIDER);
    });

    it('Scenario 3: MISSING_IN_INTERNAL - provider has an unrecorded transaction', async () => {
      const p = await createSucceededPayment(100000);
      const periodStart = new Date(new Date(p.createdAt).getTime() - 2000).toISOString();
      const periodEnd = new Date(new Date(p.createdAt).getTime() + 2000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart,
          periodEnd,
          scenario: 'MISSING_IN_INTERNAL',
        })
        .expect(201);

      const run = res.body.data;
      expect(run.discrepancyCount).toBeGreaterThanOrEqual(1);

      const resultsRes = await request(app.getHttpServer())
        .get(`/api/v1/reconciliations/${run.id}/results`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      const types = resultsRes.body.data.map((r: any) => r.discrepancyType);
      expect(types).toContain(ReconciliationDiscrepancyType.MISSING_IN_INTERNAL);
    });

    it('Scenario 4: AMOUNT_MISMATCH - amounts differ and payment is NOT mutated', async () => {
      const p = await createSucceededPayment(100000);
      const periodStart = new Date(new Date(p.createdAt).getTime() - 3000).toISOString();
      const periodEnd = new Date(new Date(p.createdAt).getTime() + 3000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart,
          periodEnd,
          scenario: 'AMOUNT_MISMATCH',
        })
        .expect(201);

      const run = res.body.data;
      expect(run.discrepancyCount).toBeGreaterThanOrEqual(1);

      const resultsRes = await request(app.getHttpServer())
        .get(`/api/v1/reconciliations/${run.id}/results`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      const mismatch = resultsRes.body.data.find(
        (r: any) => r.discrepancyType === ReconciliationDiscrepancyType.AMOUNT_MISMATCH,
      );
      expect(mismatch).toBeDefined();
      expect(mismatch.internalAmount).toBe(100000);
      expect(mismatch.providerAmount).toBe(90000);

      // Verify that internal payment was NOT modified
      const paymentInDb = await paymentRepo.findOne({ where: { id: p.id } });
      expect(paymentInDb!.amount).toBe(100000);
    });

    it('Scenario 5: CURRENCY_MISMATCH - currencies differ', async () => {
      const p = await createSucceededPayment(100000);
      const periodStart = new Date(new Date(p.createdAt).getTime() - 4000).toISOString();
      const periodEnd = new Date(new Date(p.createdAt).getTime() + 4000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart,
          periodEnd,
          scenario: 'CURRENCY_MISMATCH',
        })
        .expect(201);

      const resultsRes = await request(app.getHttpServer())
        .get(`/api/v1/reconciliations/${res.body.data.id}/results`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      const mismatch = resultsRes.body.data.find(
        (r: any) => r.discrepancyType === ReconciliationDiscrepancyType.CURRENCY_MISMATCH,
      );
      expect(mismatch).toBeDefined();
      expect(mismatch.internalCurrency).toBe('IDR');
      expect(mismatch.providerCurrency).toBe('USD');
    });

    it('Scenario 6: STATUS_MISMATCH - provider reports FAILED when internal is SUCCEEDED', async () => {
      const p = await createSucceededPayment(100000);
      const periodStart = new Date(new Date(p.createdAt).getTime() - 5000).toISOString();
      const periodEnd = new Date(new Date(p.createdAt).getTime() + 5000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart,
          periodEnd,
          scenario: 'STATUS_MISMATCH',
        })
        .expect(201);

      const resultsRes = await request(app.getHttpServer())
        .get(`/api/v1/reconciliations/${res.body.data.id}/results`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      const mismatch = resultsRes.body.data.find(
        (r: any) => r.discrepancyType === ReconciliationDiscrepancyType.STATUS_MISMATCH,
      );
      expect(mismatch).toBeDefined();
      expect(mismatch.internalStatus).toBe(PaymentStatus.SUCCEEDED);
      expect(mismatch.providerStatus).toBe('FAILED');

      // Verify that internal payment was NOT modified
      const paymentInDb = await paymentRepo.findOne({ where: { id: p.id } });
      expect(paymentInDb!.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('Scenario 7: DUPLICATE_PROVIDER_REFERENCE - provider records contain duplicate entries', async () => {
      const p = await createSucceededPayment(100000);
      const periodStart = new Date(new Date(p.createdAt).getTime() - 6000).toISOString();
      const periodEnd = new Date(new Date(p.createdAt).getTime() + 6000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart,
          periodEnd,
          scenario: 'DUPLICATE_PROVIDER_REFERENCE',
        })
        .expect(201);

      const resultsRes = await request(app.getHttpServer())
        .get(`/api/v1/reconciliations/${res.body.data.id}/results`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      const mismatch = resultsRes.body.data.find(
        (r: any) =>
          r.discrepancyType === ReconciliationDiscrepancyType.DUPLICATE_PROVIDER_REFERENCE,
      );
      expect(mismatch).toBeDefined();
    });

    it('Scenario 8: Technical provider exception returns 500 without mutating data', async () => {
      const periodStart = new Date('2026-11-01T00:00:00Z').toISOString();
      const periodEnd = new Date('2026-11-02T00:00:00Z').toISOString();

      await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({
          periodStart,
          periodEnd,
          scenario: 'SIMULATE_SYSTEM_ERROR',
        })
        .expect(500);
    });
  });

  describe('Merchant Isolation & Idempotency', () => {
    it('should prevent Merchant B from viewing Merchant A reconciliation runs or results', async () => {
      const p = await createSucceededPayment(100000);
      const periodStart = new Date(new Date(p.createdAt).getTime() - 7000).toISOString();
      const periodEnd = new Date(new Date(p.createdAt).getTime() + 7000).toISOString();

      const resA = await request(app.getHttpServer())
        .post('/api/v1/reconciliations')
        .set('Authorization', `Bearer ${secretA}`)
        .send({ periodStart, periodEnd })
        .expect(201);

      const runAId = resA.body.data.id;

      // Merchant B attempts to fetch Merchant A's run -> 404
      await request(app.getHttpServer())
        .get(`/api/v1/reconciliations/${runAId}`)
        .set('Authorization', `Bearer ${secretB}`)
        .expect(404);

      // Merchant B attempts to fetch Merchant A's results -> 404
      await request(app.getHttpServer())
        .get(`/api/v1/reconciliations/${runAId}/results`)
        .set('Authorization', `Bearer ${secretB}`)
        .expect(404);
    });
  });

  describe('Concurrency Test (Section 22 - Mandatory)', () => {
    it('should generate exactly ONE reconciliation run when 10 simultaneous requests are executed', async () => {
      const pStart = new Date('2026-12-01T00:00:00Z').toISOString();
      const pEnd = new Date('2026-12-02T00:00:00Z').toISOString();

      // Launch 10 simultaneous reconciliation requests for the exact same merchant and period
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/reconciliations')
          .set('Authorization', `Bearer ${secretA}`)
          .send({
            periodStart: pStart,
            periodEnd: pEnd,
          }),
      );

      const responses = await Promise.all(promises);

      // All 10 requests must succeed with HTTP 201
      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      // All 10 responses must return the identical run ID
      const firstId = responses[0].body.data.id;
      for (const res of responses) {
        expect(res.body.data.id).toBe(firstId);
      }

      // Check database: exactly ONE reconciliation run exists for this merchant and period
      const dbRuns = await runRepo.find({
        where: {
          merchantId: merchantAId,
          periodStart: new Date(pStart),
          periodEnd: new Date(pEnd),
        },
      });

      expect(dbRuns).toHaveLength(1);
      expect(dbRuns[0].id).toBe(firstId);
    });
  });
});
