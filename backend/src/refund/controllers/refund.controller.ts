import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
  Headers,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { RefundService } from '../services/refund.service';
import { IdempotencyService } from '../../payment/services/idempotency.service';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { ApiAuthGuard } from '../../auth/guards/api-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import * as crypto from 'crypto';

function generateHash(payload: any): string {
  const sortedPayload = Object.keys(payload)
    .sort()
    .reduce((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {} as any);
  return crypto.createHash('sha256').update(JSON.stringify(sortedPayload)).digest('hex');
}

@Controller()
@UseGuards(ApiAuthGuard)
export class RefundController {
  constructor(
    private readonly refundService: RefundService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post('payments/:paymentId/refunds')
  async createRefund(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
    @Body() dto: CreateRefundDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!idempotencyKey || idempotencyKey.trim() === '') {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (idempotencyKey.length > 255) {
      throw new BadRequestException('Idempotency-Key must not exceed 255 characters');
    }

    const merchantId = req.merchant.merchantId;
    const requestHash = generateHash({
      paymentId,
      amount: dto.amount,
      currency: dto.currency || '',
      reason: dto.reason || '',
    });

    let pendingDeliveryIds: string[] = [];

    const result = await this.idempotencyService.executeIdempotent(
      merchantId,
      idempotencyKey,
      requestHash,
      `/payments/${paymentId}/refunds`,
      async (manager) => {
        const { refund, deliveryIds } = await this.refundService.createRefund(
          merchantId,
          paymentId,
          dto,
          idempotencyKey,
          manager,
        );
        pendingDeliveryIds = deliveryIds;
        return {
          status: 201,
          body: {
            status: 'success',
            data: refund,
          },
        };
      },
    );

    // Dispatched asynchronously after transaction commit has succeeded
    if (pendingDeliveryIds.length > 0) {
      this.refundService.dispatchDeliveriesAsync(pendingDeliveryIds);
    }

    res.status(result.status);
    return result.body;
  }

  @Get('refunds/:id')
  async getRefund(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const merchantId = req.merchant.merchantId;
    const refund = await this.refundService.getRefund(merchantId, id);

    return {
      status: 'success',
      data: refund,
    };
  }

  @Get('payments/:paymentId/refunds')
  async listRefundsForPayment(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
  ) {
    const merchantId = req.merchant.merchantId;
    const refunds = await this.refundService.listRefundsForPayment(merchantId, paymentId);

    return {
      status: 'success',
      data: refunds,
    };
  }
}
