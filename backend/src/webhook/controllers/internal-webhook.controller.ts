import {
  Controller,
  Post,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiAuthGuard } from '../../auth/guards/api-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { WebhookDeliveryService } from '../services/webhook-delivery.service';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';

@Controller('internal/webhook-deliveries')
@UseGuards(ApiAuthGuard)
export class InternalWebhookController {
  constructor(
    private readonly webhookDeliveryService: WebhookDeliveryService,
    private readonly configService: ConfigService,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
  ) {}

  @Post(':id/deliver')
  async triggerDelivery(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const isAllowed = Boolean(this.configService.get<boolean>('ALLOW_DEV_WEBHOOK_DELIVERY'));
    if (!isAllowed) {
      throw new NotFoundException();
    }

    const merchantId = req.merchant.merchantId;

    // Verify ownership: delivery must belong to authenticated merchant
    const delivery = await this.deliveryRepository.findOne({
      where: { id },
      relations: { webhookEvent: true },
    });

    if (!delivery || delivery.webhookEvent?.merchantId !== merchantId) {
      throw new NotFoundException('Webhook delivery record not found');
    }

    const updatedDelivery = await this.webhookDeliveryService.deliver(id);
    return {
      status: 'success',
      data: updatedDelivery,
    };
  }
}
