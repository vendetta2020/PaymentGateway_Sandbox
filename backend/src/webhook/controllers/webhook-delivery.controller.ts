import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiAuthGuard } from '../../auth/guards/api-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { WebhookDeliveryService } from '../services/webhook-delivery.service';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Webhook Deliveries')
@ApiBearerAuth('API-Key')
@Controller('webhook-deliveries')
@UseGuards(ApiAuthGuard)
export class WebhookDeliveryController {
  constructor(
    private readonly webhookDeliveryService: WebhookDeliveryService,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
  ) {}

  @ApiOperation({ summary: 'List recent webhook deliveries for the authenticated merchant' })
  @Get()
  async listDeliveries(@Req() req: AuthenticatedRequest) {
    const merchantId = req.merchant.merchantId;
    const deliveries = await this.webhookDeliveryService.listDeliveriesForMerchant(merchantId);

    return {
      status: 'success',
      data: deliveries,
    };
  }

  @ApiOperation({ summary: 'Retry a failed webhook delivery attempt' })
  @Post(':id/retry')
  async retryDelivery(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const merchantId = req.merchant.merchantId;

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
