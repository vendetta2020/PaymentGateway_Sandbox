import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import * as http from 'http';
import { AddressInfo } from 'net';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { Merchant } from '../src/merchant/entities/merchant.entity';
import { ApiCredentialService } from '../src/auth/services/api-credential.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../src/payment/entities/payment.entity';
import { MerchantWebhookConfig } from '../src/webhook/entities/webhook-config.entity';
import { WebhookEvent } from '../src/webhook/entities/webhook-event.entity';
import { WebhookDelivery } from '../src/webhook/entities/webhook-delivery.entity';
import { WebhookDeliveryStatus } from '../src/webhook/enums/webhook-delivery-status.enum';
import { WebhookEventType } from '../src/webhook/enums/webhook-event-type.enum';
import { WebhookEventService } from '../src/webhook/services/webhook-event.service';
import { verifyWebhookSignature } from '../src/webhook/services/webhook-delivery.service';

describe('WebhookModule (e2e)', () => {
  let app: INestApplication;
  let merchantRepo: Repository<Merchant>;
  let paymentRepo: Repository<Payment>;
  let configRepo: Repository<MerchantWebhookConfig>;
  let eventRepo: Repository<WebhookEvent>;
  let deliveryRepo: Repository<WebhookDelivery>;
  let apiCredentialService: ApiCredentialService;
  let webhookEventService: WebhookEventService;

  let merchantAId: string;
  let secretA: string;

  let merchantBId: string;
  let secretB: string;

  // Mock HTTP Receiver Server
  let receiverServer: http.Server;
  let receiverPort: number;
  let receivedRequests: Array<{
    headers: http.IncomingHttpHeaders;
    body: any;
    rawBody: string;
  }> = [];
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
        } catch {
          // invalid json ignored
        }
        receivedRequests.push({
          headers: req.headers,
          body: parsedBody,
          rawBody: bodyStr,
        });
        res.statusCode = receiverStatusCode;
        res.end(JSON.stringify({ received: true }));
      });
    });

    await new Promise<void>((resolve) => {
      receiverServer.listen(0, '127.0.0.1', () => {
        receiverPort = (receiverServer.address() as AddressInfo).port;
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

    merchantRepo = moduleFixture.get(getRepositoryToken(Merchant));
    paymentRepo = moduleFixture.get(getRepositoryToken(Payment));
    configRepo = moduleFixture.get(getRepositoryToken(MerchantWebhookConfig));
    eventRepo = moduleFixture.get(getRepositoryToken(WebhookEvent));
    deliveryRepo = moduleFixture.get(getRepositoryToken(WebhookDelivery));
    apiCredentialService = moduleFixture.get(ApiCredentialService);
    webhookEventService = moduleFixture.get(WebhookEventService);

    // Initial database cleanup
    await deliveryRepo.query('DELETE FROM webhook_deliveries');
    await eventRepo.query('DELETE FROM webhook_events');
    await configRepo.query('DELETE FROM merchant_webhook_configs');
    await paymentRepo.query('DELETE FROM idempotency_keys');
    await paymentRepo.query('DELETE FROM payments');
    await merchantRepo.query('DELETE FROM api_credentials');
    await merchantRepo.query('DELETE FROM merchants');

    // Create Merchant A
    const mA = await merchantRepo.save(
      merchantRepo.create({
        name: 'Webhook Merchant A',
        businessName: 'Business A',
        email: 'wh_a@example.com',
      }),
    );
    merchantAId = mA.id;
    const credA = await apiCredentialService.createCredential(merchantAId);
    secretA = credA.plaintextSecret;

    // Create Merchant B
    const mB = await merchantRepo.save(
      merchantRepo.create({
        name: 'Webhook Merchant B',
        businessName: 'Business B',
        email: 'wh_b@example.com',
      }),
    );
    merchantBId = mB.id;
    const credB = await apiCredentialService.createCredential(merchantBId);
    secretB = credB.plaintextSecret;
  });

  afterAll(async () => {
    await deliveryRepo.query('DELETE FROM webhook_deliveries');
    await eventRepo.query('DELETE FROM webhook_events');
    await configRepo.query('DELETE FROM merchant_webhook_configs');
    await paymentRepo.query('DELETE FROM idempotency_keys');
    await paymentRepo.query('DELETE FROM payments');
    await merchantRepo.query('DELETE FROM api_credentials');
    await merchantRepo.query('DELETE FROM merchants');

    await app.close();
    await new Promise<void>((resolve) => receiverServer.close(() => resolve()));
  });

  beforeEach(() => {
    receivedRequests = [];
    receiverStatusCode = 200;
  });

  describe('Merchant Webhook Configuration API', () => {
    let createdConfigId: string;

    it('POST /api/v1/webhook-configs should create config and return signingSecret ONCE', async () => {
      const endpointUrl = `http://127.0.0.1:${receiverPort}/webhook`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhook-configs')
        .set('Authorization', `Bearer ${secretA}`)
        .send({ endpointUrl })
        .expect(201);

      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.merchantId).toBe(merchantAId);
      expect(response.body.data.endpointUrl).toBe(endpointUrl);
      expect(response.body.data.status).toBe('ACTIVE');
      expect(response.body.data.signingSecret).toMatch(/^whsec_[a-f0-9]{64}$/);

      createdConfigId = response.body.data.id;
    });

    it('GET /api/v1/webhook-configs should list configs WITHOUT exposing signingSecret', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/webhook-configs')
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(createdConfigId);
      expect(response.body.data[0].signingSecret).toBeUndefined();
    });

    it('GET /api/v1/webhook-configs/:id should get single config WITHOUT signingSecret', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/webhook-configs/${createdConfigId}`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      expect(response.body.data.id).toBe(createdConfigId);
      expect(response.body.data.signingSecret).toBeUndefined();
    });

    it('Merchant B cannot access Merchant A webhook config (404 isolation)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/webhook-configs/${createdConfigId}`)
        .set('Authorization', `Bearer ${secretB}`)
        .expect(404);
    });

    it('DELETE /api/v1/webhook-configs/:id should disable config', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/webhook-configs/${createdConfigId}`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      expect(response.body.data.status).toBe('DISABLED');

      // Re-enable for subsequent tests
      await configRepo.update({ id: createdConfigId }, { status: 'ACTIVE' as any });
    });
  });

  describe('End-to-End Payment Lifecycle & Webhook Delivery', () => {
    let signingSecret: string;
    let paymentId: string;

    beforeAll(async () => {
      // Ensure Merchant A has an active webhook config pointing to test receiver
      const endpointUrl = `http://127.0.0.1:${receiverPort}/webhook`;
      const configRes = await request(app.getHttpServer())
        .post('/api/v1/webhook-configs')
        .set('Authorization', `Bearer ${secretA}`)
        .send({ endpointUrl });

      signingSecret = configRes.body.data.signingSecret;
    });

    it('Payment creation should emit payment.created event and deliver signed webhook', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'wh-create-1')
        .send({
          amount: 250000,
          currency: 'IDR',
          orderId: 'ORD-WH-001',
          paymentMethod: 'QRIS',
        })
        .expect(201);

      paymentId = response.body.data.id;

      // Wait a short moment for the asynchronous delivery to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(receivedRequests.length).toBeGreaterThanOrEqual(1);
      const req = receivedRequests[receivedRequests.length - 1];

      // Validate Headers
      expect(req.headers['x-webhook-id']).toBeDefined();
      expect(req.headers['x-webhook-timestamp']).toBeDefined();
      expect(req.headers['x-webhook-signature']).toBeDefined();

      // Verify HMAC-SHA256 Signature
      const isValid = verifyWebhookSignature(
        signingSecret,
        req.headers['x-webhook-timestamp'] as string,
        req.rawBody,
        req.headers['x-webhook-signature'] as string,
      );
      expect(isValid).toBe(true);

      // Validate Payload structure & data
      expect(req.body.type).toBe('payment.created');
      expect(req.body.data.payment.id).toBe(paymentId);
      expect(req.body.data.payment.amount).toBe(250000);
      expect(req.body.data.payment.status).toBe('PENDING');
    });

    it('Payment process to SUCCEEDED should emit payment.succeeded event and deliver webhook', async () => {
      receivedRequests = [];

      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentId}/process`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'wh-proc-1')
        .send()
        .expect(201);

      expect(response.body.data.status).toBe('SUCCEEDED');

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(receivedRequests.length).toBeGreaterThanOrEqual(1);
      const req = receivedRequests[receivedRequests.length - 1];

      expect(req.body.type).toBe('payment.succeeded');
      expect(req.body.data.payment.id).toBe(paymentId);
      expect(req.body.data.payment.status).toBe('SUCCEEDED');

      // Verify Signature
      const isValid = verifyWebhookSignature(
        signingSecret,
        req.headers['x-webhook-timestamp'] as string,
        req.rawBody,
        req.headers['x-webhook-signature'] as string,
      );
      expect(isValid).toBe(true);
    });

    it('Payment remains SUCCESS even if webhook endpoint fails (HTTP 500)', async () => {
      receiverStatusCode = 500;
      receivedRequests = [];

      // Create a new payment with simulated failure endpoint
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'wh-fail-create')
        .send({
          amount: 50000,
          currency: 'IDR',
          orderId: 'ORD-WH-FAIL-TEST',
          paymentMethod: 'QRIS',
        })
        .expect(201);

      const failPaymentId = createRes.body.data.id;

      // Process payment
      const procRes = await request(app.getHttpServer())
        .post(`/api/v1/payments/${failPaymentId}/process`)
        .set('Authorization', `Bearer ${secretA}`)
        .set('Idempotency-Key', 'wh-fail-proc')
        .send()
        .expect(201);

      // Payment state is strictly SUCCEEDED despite webhook endpoint failure
      expect(procRes.body.data.status).toBe('SUCCEEDED');

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify in DB that payment is SUCCEEDED and delivery is marked FAILED
      const dbPayment = await paymentRepo.findOne({ where: { id: failPaymentId } });
      expect(dbPayment?.status).toBe('SUCCEEDED');

      const deliveries = await deliveryRepo.find({
        order: { createdAt: 'DESC' },
        take: 1,
      });
      expect(deliveries[0].status).toBe(WebhookDeliveryStatus.FAILED);
      expect(deliveries[0].lastHttpStatus).toBe(500);
      expect(deliveries[0].nextAttemptAt).toBeDefined();
    });

    it('POST /api/v1/internal/webhook-deliveries/:id/deliver should manually trigger retry', async () => {
      // Find the failed delivery from previous test
      const failedDelivery = await deliveryRepo.findOne({
        where: { status: WebhookDeliveryStatus.FAILED },
        relations: { webhookEvent: true },
      });

      expect(failedDelivery).toBeDefined();

      // Set receiver back to 200 OK
      receiverStatusCode = 200;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/internal/webhook-deliveries/${failedDelivery!.id}/deliver`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(201);

      expect(response.body.data.status).toBe(WebhookDeliveryStatus.DELIVERED);
      expect(response.body.data.lastHttpStatus).toBe(200);
      expect(response.body.data.deliveredAt).toBeDefined();
    });

    it('Merchant B cannot trigger delivery for Merchant A (404 isolation)', async () => {
      const anyDelivery = await deliveryRepo.findOne({
        where: {},
        relations: { webhookEvent: true },
      });

      await request(app.getHttpServer())
        .post(`/api/v1/internal/webhook-deliveries/${anyDelivery!.id}/deliver`)
        .set('Authorization', `Bearer ${secretB}`)
        .expect(404);
    });

    it('Delivery transitions to EXHAUSTED on non-retryable 400', async () => {
      const anyDelivery = await deliveryRepo.findOne({
        where: {},
      });

      // Reset to PENDING for testing
      await deliveryRepo.update({ id: anyDelivery!.id }, { status: WebhookDeliveryStatus.PENDING });

      receiverStatusCode = 400;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/internal/webhook-deliveries/${anyDelivery!.id}/deliver`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(201);

      expect(response.body.data.status).toBe(WebhookDeliveryStatus.EXHAUSTED);
      expect(response.body.data.lastHttpStatus).toBe(400);
      expect(response.body.data.nextAttemptAt).toBeNull();
    });
  });

  describe('Webhook Concurrency & Deduplication', () => {
    it('Concurrent event recording for the same transition should produce exactly ONE WebhookEvent', async () => {
      const dummyPayment = await paymentRepo.save(
        paymentRepo.create({
          merchantId: merchantAId,
          amount: 10000,
          currency: 'IDR',
          orderId: 'CONCUR-EVENT-TEST',
          paymentMethod: 'QRIS' as any,
          status: 'SUCCEEDED' as any,
        }),
      );

      // Trigger 5 concurrent event recording calls for the same transition
      const promises = Array.from({ length: 5 }).map(() =>
        webhookEventService.recordPaymentEvent(
          merchantAId,
          dummyPayment,
          WebhookEventType.PAYMENT_SUCCEEDED,
        ),
      );

      await Promise.all(promises);

      // Verify DB uniqueness constraint: exactly 1 event created
      const eventCount = await eventRepo.count({
        where: {
          merchantId: merchantAId,
          eventKey: `${dummyPayment.id}:${WebhookEventType.PAYMENT_SUCCEEDED}`,
        },
      });

      expect(eventCount).toBe(1);
    });

    it('Concurrent webhook delivery retries should only dispatch ONE HTTP request', async () => {
      const endpointUrl = `http://127.0.0.1:${receiverPort}/webhook`;
      const configRes = await request(app.getHttpServer())
        .post('/api/v1/webhook-configs')
        .set('Authorization', `Bearer ${secretA}`)
        .send({ endpointUrl });

      const dummyPayment = await paymentRepo.save(
        paymentRepo.create({
          merchantId: merchantAId,
          amount: 10000,
          currency: 'IDR',
          orderId: 'CONCUR-DELIVERY-TEST',
          paymentMethod: 'QRIS' as any,
          status: 'SUCCEEDED' as any,
        }),
      );

      const event = await eventRepo.save(
        eventRepo.create({
          merchantId: merchantAId,
          eventKey: 'CONCUR-DELIVERY-TEST-KEY',
          eventType: WebhookEventType.PAYMENT_SUCCEEDED,
          payload: { test: true },
          paymentId: dummyPayment.id,
        }),
      );

      const delivery = await deliveryRepo.save(
        deliveryRepo.create({
          webhookEvent: event,
          webhookConfig: { id: configRes.body.data.id } as any,
          status: WebhookDeliveryStatus.PENDING,
          attemptCount: 0,
        }),
      );

      receivedRequests = [];

      const promises = Array.from({ length: 3 }).map(() =>
        request(app.getHttpServer())
          .post(`/api/v1/internal/webhook-deliveries/${delivery.id}/deliver`)
          .set('Authorization', `Bearer ${secretA}`),
      );

      await Promise.all(promises);

      expect(receivedRequests.length).toBe(1);

      const updatedDelivery = await deliveryRepo.findOne({ where: { id: delivery.id } });
      expect(updatedDelivery!.attemptCount).toBe(1);
      expect(updatedDelivery!.status).toBe(WebhookDeliveryStatus.DELIVERED);
    });
  });

  describe('Webhook SSRF Protection', () => {
    it('Should block delivery to private IPs when ALLOW_DEV_LOCAL_WEBHOOKS is false', async () => {
      const configService = app.get(ConfigService);
      const originalGet = configService.get.bind(configService);
      jest.spyOn(configService, 'get').mockImplementation((key) => {
        if (key === 'ALLOW_DEV_LOCAL_WEBHOOKS') return false;
        return originalGet(key);
      });

      const endpointUrl = `http://127.0.0.1:${receiverPort}/webhook`;
      const configRes = await request(app.getHttpServer())
        .post('/api/v1/webhook-configs')
        .set('Authorization', `Bearer ${secretA}`)
        .send({ endpointUrl });

      const dummyPayment = await paymentRepo.save(
        paymentRepo.create({
          merchantId: merchantAId,
          amount: 10000,
          currency: 'IDR',
          orderId: 'SSRF-TEST',
          paymentMethod: 'QRIS' as any,
          status: 'SUCCEEDED' as any,
        }),
      );

      const event = await eventRepo.save(
        eventRepo.create({
          merchantId: merchantAId,
          eventKey: 'SSRF-TEST-KEY',
          eventType: WebhookEventType.PAYMENT_SUCCEEDED,
          payload: { test: true },
          paymentId: dummyPayment.id,
        }),
      );

      const delivery = await deliveryRepo.save(
        deliveryRepo.create({
          webhookEvent: event,
          webhookConfig: { id: configRes.body.data.id } as any,
          status: WebhookDeliveryStatus.PENDING,
          attemptCount: 0,
        }),
      );

      receivedRequests = [];

      const response = await request(app.getHttpServer())
        .post(`/api/v1/internal/webhook-deliveries/${delivery.id}/deliver`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(201);

      expect(response.body.data.status).toBe(WebhookDeliveryStatus.EXHAUSTED);
      expect(response.body.data.lastError).toMatch(/SSRF Blocked/);
      expect(receivedRequests.length).toBe(0);

      jest.restoreAllMocks();
    });
  });

  describe('Authenticated Webhook Deliveries Visibility & Retry', () => {
    let merchantADeliveryId: string;

    beforeAll(async () => {
      const endpointUrl = `http://127.0.0.1:${receiverPort}/webhook`;
      const configRes = await request(app.getHttpServer())
        .post('/api/v1/webhook-configs')
        .set('Authorization', `Bearer ${secretA}`)
        .send({ endpointUrl });

      const dummyPayment = await paymentRepo.save(
        paymentRepo.create({
          merchantId: merchantAId,
          amount: 500,
          currency: 'IDR',
          orderId: 'RETRY-TEST-ISOLATION',
          paymentMethod: 'QRIS' as any,
          status: 'SUCCEEDED' as any,
        }),
      );

      const event = await eventRepo.save(
        eventRepo.create({
          merchantId: merchantAId,
          eventKey: 'RETRY-TEST-ISOLATION-KEY',
          eventType: WebhookEventType.PAYMENT_SUCCEEDED,
          payload: { test: true },
          paymentId: dummyPayment.id,
        }),
      );

      const delivery = await deliveryRepo.save(
        deliveryRepo.create({
          webhookEvent: event,
          webhookConfig: { id: configRes.body.data.id } as any,
          status: WebhookDeliveryStatus.FAILED,
          attemptCount: 1,
        }),
      );

      merchantADeliveryId = delivery.id;
    });

    it('GET /api/v1/webhook-deliveries should return delivery history with events for Merchant A', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/webhook-deliveries')
        .set('Authorization', `Bearer ${secretA}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);

      // Find the specific delivery we created
      const delivery = response.body.data.find((d: any) => d.id === merchantADeliveryId);
      expect(delivery).toBeDefined();
      expect(delivery.status).toBeDefined();
      expect(delivery.attemptCount).toBeGreaterThanOrEqual(0);
      expect(delivery.webhookEvent).toBeDefined();
      expect(delivery.webhookEvent.merchantId).toBe(merchantAId);
      expect(delivery.webhookEvent.eventType).toBeDefined();
      expect(delivery.webhookEvent.payload).toBeDefined();
      expect(delivery.webhookConfig).toBeDefined();
      expect(delivery.webhookConfig.signingSecret).toBeUndefined();
    });

    it('GET /api/v1/webhook-deliveries should preserve merchant isolation (Merchant B sees 0 of A)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/webhook-deliveries')
        .set('Authorization', `Bearer ${secretB}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveLength(0);
    });

    it('POST /api/v1/webhook-deliveries/:id/retry should retry delivery for authenticated merchant', async () => {
      receiverStatusCode = 200;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/webhook-deliveries/${merchantADeliveryId}/retry`)
        .set('Authorization', `Bearer ${secretA}`)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.id).toBe(merchantADeliveryId);
      expect(response.body.data.status).toBe(WebhookDeliveryStatus.DELIVERED);
      expect(response.body.data.lastHttpStatus).toBe(200);
    });

    it('POST /api/v1/webhook-deliveries/:id/retry should return 404 for Merchant B (isolation)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/webhook-deliveries/${merchantADeliveryId}/retry`)
        .set('Authorization', `Bearer ${secretB}`)
        .expect(404);
    });
  });
});
