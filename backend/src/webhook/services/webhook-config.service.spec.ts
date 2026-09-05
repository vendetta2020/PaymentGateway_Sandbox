import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { WebhookConfigService } from './webhook-config.service';
import { MerchantWebhookConfig } from '../entities/webhook-config.entity';
import { WebhookConfigStatus } from '../enums/webhook-config-status.enum';

describe('WebhookConfigService', () => {
  let service: WebhookConfigService;
  let configRepo: jest.Mocked<Repository<MerchantWebhookConfig>>;

  beforeEach(async () => {
    configRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookConfigService,
        {
          provide: getRepositoryToken(MerchantWebhookConfig),
          useValue: configRepo,
        },
      ],
    }).compile();

    service = module.get<WebhookConfigService>(WebhookConfigService);
  });

  describe('createConfig', () => {
    it('should generate secure 32-byte secret and return it ONCE upon creation', async () => {
      const merchantId = 'm-1';
      const dto = { endpointUrl: 'https://example.com/webhook' };

      configRepo.create.mockImplementation((entity: any) => ({
        ...entity,
        id: 'cfg-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      configRepo.save.mockImplementation(async (entity: any) => entity);

      const result = await service.createConfig(merchantId, dto);

      expect(result.id).toBe('cfg-1');
      expect(result.merchantId).toBe(merchantId);
      expect(result.endpointUrl).toBe(dto.endpointUrl);
      expect(result.status).toBe(WebhookConfigStatus.ACTIVE);
      expect(result.signingSecret).toBeDefined();
      expect(result.signingSecret).toMatch(/^whsec_[a-f0-9]{64}$/);

      expect(configRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId,
          endpointUrl: dto.endpointUrl,
          status: WebhookConfigStatus.ACTIVE,
          signingSecret: expect.stringMatching(/^whsec_[a-f0-9]{64}$/),
        }),
      );
    });
  });

  describe('listConfigs', () => {
    it('should NEVER expose signingSecret in list results', async () => {
      const merchantId = 'm-1';
      configRepo.find.mockResolvedValue([
        {
          id: 'cfg-1',
          merchantId,
          endpointUrl: 'https://example.com/webhook1',
          signingSecret: 'whsec_secret1',
          status: WebhookConfigStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as MerchantWebhookConfig,
      ]);

      const results = await service.listConfigs(merchantId);

      expect(results).toHaveLength(1);
      expect(results[0].endpointUrl).toBe('https://example.com/webhook1');
      expect(results[0].signingSecret).toBeUndefined();
    });
  });

  describe('getConfig', () => {
    it('should return config without signingSecret', async () => {
      const merchantId = 'm-1';
      configRepo.findOne.mockResolvedValue({
        id: 'cfg-1',
        merchantId,
        endpointUrl: 'https://example.com/webhook',
        signingSecret: 'whsec_secret',
        status: WebhookConfigStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as MerchantWebhookConfig);

      const result = await service.getConfig(merchantId, 'cfg-1');

      expect(result.id).toBe('cfg-1');
      expect(result.signingSecret).toBeUndefined();
    });

    it('should throw NotFoundException if config does not exist or belongs to another merchant', async () => {
      configRepo.findOne.mockResolvedValue(null);

      await expect(service.getConfig('m-other', 'cfg-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('disableConfig', () => {
    it('should set status to DISABLED', async () => {
      const merchantId = 'm-1';
      const existing = {
        id: 'cfg-1',
        merchantId,
        endpointUrl: 'https://example.com/webhook',
        signingSecret: 'whsec_secret',
        status: WebhookConfigStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as MerchantWebhookConfig;

      configRepo.findOne.mockResolvedValue(existing);
      configRepo.save.mockImplementation(async (entity: any) => entity);

      const result = await service.disableConfig(merchantId, 'cfg-1');

      expect(result.status).toBe(WebhookConfigStatus.DISABLED);
      expect(configRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WebhookConfigStatus.DISABLED }),
      );
    });
  });
});
