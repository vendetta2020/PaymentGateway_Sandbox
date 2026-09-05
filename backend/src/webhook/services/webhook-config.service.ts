import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { MerchantWebhookConfig } from '../entities/webhook-config.entity';
import { CreateWebhookConfigDto } from '../dto/create-webhook-config.dto';
import { WebhookConfigStatus } from '../enums/webhook-config-status.enum';
import * as crypto from 'crypto';

export interface WebhookConfigResponse {
  id: string;
  merchantId: string;
  endpointUrl: string;
  status: WebhookConfigStatus;
  createdAt: Date;
  updatedAt: Date;
  signingSecret?: string;
}

@Injectable()
export class WebhookConfigService {
  constructor(
    @InjectRepository(MerchantWebhookConfig)
    private readonly configRepository: Repository<MerchantWebhookConfig>,
  ) {}

  /**
   * Generates a cryptographically secure 32-byte signing secret.
   * Format: whsec_<64-hex-chars>
   */
  private generateSigningSecret(): string {
    return `whsec_${crypto.randomBytes(32).toString('hex')}`;
  }

  async createConfig(
    merchantId: string,
    dto: CreateWebhookConfigDto,
  ): Promise<WebhookConfigResponse> {
    const rawSecret = this.generateSigningSecret();

    const config = this.configRepository.create({
      merchantId,
      endpointUrl: dto.endpointUrl,
      signingSecret: rawSecret,
      status: WebhookConfigStatus.ACTIVE,
    });

    const saved = await this.configRepository.save(config);

    // Return the signingSecret ONCE upon creation.
    // It will never be returned again via GET or list endpoints.
    return {
      id: saved.id,
      merchantId: saved.merchantId,
      endpointUrl: saved.endpointUrl,
      status: saved.status,
      signingSecret: rawSecret,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async listConfigs(merchantId: string): Promise<WebhookConfigResponse[]> {
    const configs = await this.configRepository.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });

    // Never expose signingSecret in list endpoints
    return configs.map((c) => ({
      id: c.id,
      merchantId: c.merchantId,
      endpointUrl: c.endpointUrl,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async getConfig(merchantId: string, id: string): Promise<WebhookConfigResponse> {
    const config = await this.configRepository.findOne({
      where: { id, merchantId },
    });

    if (!config) {
      throw new NotFoundException('Webhook configuration not found');
    }

    return {
      id: config.id,
      merchantId: config.merchantId,
      endpointUrl: config.endpointUrl,
      status: config.status,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async disableConfig(merchantId: string, id: string): Promise<WebhookConfigResponse> {
    const config = await this.configRepository.findOne({
      where: { id, merchantId },
    });

    if (!config) {
      throw new NotFoundException('Webhook configuration not found');
    }

    config.status = WebhookConfigStatus.DISABLED;
    const updated = await this.configRepository.save(config);

    return {
      id: updated.id,
      merchantId: updated.merchantId,
      endpointUrl: updated.endpointUrl,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async getActiveConfigs(
    merchantId: string,
    manager?: EntityManager,
  ): Promise<MerchantWebhookConfig[]> {
    const repo = manager ? manager.getRepository(MerchantWebhookConfig) : this.configRepository;

    return repo.find({
      where: { merchantId, status: WebhookConfigStatus.ACTIVE },
    });
  }
}
