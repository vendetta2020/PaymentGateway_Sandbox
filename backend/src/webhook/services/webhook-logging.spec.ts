import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { MetricsService } from '../../common/metrics/metrics.service';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import { WebhookConfigStatus } from '../enums/webhook-config-status.enum';
import { Logger } from '@nestjs/common';

describe('Webhook Operational Events Persistence Order', () => {
  let service: WebhookDeliveryService;
  let deliveryRepo: any;
  let metricsService: MetricsService;
  let loggerSpyLog: jest.SpyInstance;
  let loggerSpyError: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    const queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation(async (_, e) => e),
      },
    };

    deliveryRepo = {
      save: jest.fn().mockImplementation(async (e) => e),
      manager: {
        connection: { createQueryRunner: () => queryRunnerMock },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDeliveryService,
        MetricsService,
        { provide: getRepositoryToken(WebhookDelivery), useValue: deliveryRepo },
        { provide: getRepositoryToken(WebhookEvent), useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(WebhookDeliveryService);
    metricsService = module.get(MetricsService);

    // Provide the required relations for delivery fetching
    queryRunnerMock.manager.findOne
      .mockResolvedValueOnce({
        id: 'del-1',
        status: WebhookDeliveryStatus.PENDING,
        attemptCount: 0,
      })
      .mockResolvedValueOnce({
        id: 'del-1',
        webhookEvent: { id: 'evt-1', merchantId: 'm1', payload: {} },
        webhookConfig: {
          endpointUrl: 'https://valid.com',
          signingSecret: 'secret',
          status: WebhookConfigStatus.ACTIVE,
        },
      });

    loggerSpyLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    loggerSpyError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(metricsService, 'increment');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log succeeded event when HTTP call and DB save succeed', async () => {
    jest
      .spyOn(service as any, 'validateUrlSecurity')
      .mockResolvedValue({ isValid: true, pinnedIp: '1.2.3.4' });
    jest.spyOn(service as any, 'dispatchWebhook').mockResolvedValue({ status: 200, ok: true });

    await service.deliver('del-1');

    expect(deliveryRepo.save).toHaveBeenCalled();
    expect(loggerSpyLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'webhook.delivery.succeeded' }),
    );
    expect(metricsService.increment).toHaveBeenCalledWith('webhooksSucceeded');
  });

  it('should not log succeeded event if DB save fails after successful HTTP dispatch', async () => {
    jest
      .spyOn(service as any, 'validateUrlSecurity')
      .mockResolvedValue({ isValid: true, pinnedIp: '1.2.3.4' });
    jest.spyOn(service as any, 'dispatchWebhook').mockResolvedValue({ status: 200, ok: true });

    deliveryRepo.save.mockRejectedValueOnce(new Error('DB failure'));

    await expect(service.deliver('del-1')).rejects.toThrow('DB failure');

    // Make sure no operational success was logged because the DB failed!
    expect(loggerSpyLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'webhook.delivery.succeeded' }),
    );
    expect(metricsService.increment).not.toHaveBeenCalledWith('webhooksSucceeded');
  });

  it('should log exhausted event when delivery is terminal and DB save succeeds', async () => {
    jest
      .spyOn(service as any, 'validateUrlSecurity')
      .mockResolvedValue({ isValid: true, pinnedIp: '1.2.3.4' });
    jest.spyOn(service as any, 'dispatchWebhook').mockResolvedValue({ status: 400, ok: false }); // non-retryable

    await service.deliver('del-1');

    expect(deliveryRepo.save).toHaveBeenCalled();
    expect(loggerSpyError).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'webhook.delivery.exhausted' }),
    );
    expect(metricsService.increment).toHaveBeenCalledWith('webhooksFailed');
  });

  it('should not log exhausted event if DB save fails on terminal delivery', async () => {
    jest
      .spyOn(service as any, 'validateUrlSecurity')
      .mockResolvedValue({ isValid: true, pinnedIp: '1.2.3.4' });
    jest.spyOn(service as any, 'dispatchWebhook').mockResolvedValue({ status: 400, ok: false });
    deliveryRepo.save.mockRejectedValueOnce(new Error('DB failure'));

    await expect(service.deliver('del-1')).rejects.toThrow('DB failure');

    expect(loggerSpyError).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'webhook.delivery.exhausted' }),
    );
    expect(metricsService.increment).not.toHaveBeenCalledWith('webhooksFailed');
  });

  it('should not log exhausted event if SSRF block occurs but DB save fails', async () => {
    jest
      .spyOn(service as any, 'validateUrlSecurity')
      .mockResolvedValue({ isValid: false, reason: 'SSRF' });
    deliveryRepo.save.mockRejectedValueOnce(new Error('DB failure'));

    await expect(service.deliver('del-1')).rejects.toThrow('DB failure');

    expect(loggerSpyError).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'webhook.delivery.exhausted' }),
    );
  });
});
