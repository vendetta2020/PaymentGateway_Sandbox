import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantWebhookConfig } from './entities/webhook-config.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookConfigService } from './services/webhook-config.service';
import { WebhookEventService } from './services/webhook-event.service';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { WebhookConfigController } from './controllers/webhook-config.controller';
import { InternalWebhookController } from './controllers/internal-webhook.controller';
import { WebhookDeliveryController } from './controllers/webhook-delivery.controller';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MerchantWebhookConfig, WebhookEvent, WebhookDelivery]),
    CommonModule,
    AuthModule,
  ],
  controllers: [WebhookConfigController, InternalWebhookController, WebhookDeliveryController],
  providers: [WebhookConfigService, WebhookEventService, WebhookDeliveryService],
  exports: [WebhookConfigService, WebhookEventService, WebhookDeliveryService],
})
export class WebhookModule {}
