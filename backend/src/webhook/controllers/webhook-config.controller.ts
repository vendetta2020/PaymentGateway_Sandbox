import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiAuthGuard } from '../../auth/guards/api-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { WebhookConfigService } from '../services/webhook-config.service';
import { CreateWebhookConfigDto } from '../dto/create-webhook-config.dto';

@Controller('webhook-configs')
@UseGuards(ApiAuthGuard)
export class WebhookConfigController {
  constructor(private readonly webhookConfigService: WebhookConfigService) {}

  @Post()
  async createConfig(@Req() req: AuthenticatedRequest, @Body() dto: CreateWebhookConfigDto) {
    const merchantId = req.merchant.merchantId;
    const config = await this.webhookConfigService.createConfig(merchantId, dto);
    return {
      status: 'success',
      data: config,
    };
  }

  @Get()
  async listConfigs(@Req() req: AuthenticatedRequest) {
    const merchantId = req.merchant.merchantId;
    const configs = await this.webhookConfigService.listConfigs(merchantId);
    return {
      status: 'success',
      data: configs,
    };
  }

  @Get(':id')
  async getConfig(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const merchantId = req.merchant.merchantId;
    const config = await this.webhookConfigService.getConfig(merchantId, id);
    return {
      status: 'success',
      data: config,
    };
  }

  @Delete(':id')
  async disableConfig(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const merchantId = req.merchant.merchantId;
    const config = await this.webhookConfigService.disableConfig(merchantId, id);
    return {
      status: 'success',
      data: config,
    };
  }
}
