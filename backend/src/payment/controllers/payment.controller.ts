import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Headers,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { IdempotencyService } from '../services/idempotency.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { ApiAuthGuard } from '../../auth/guards/api-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import * as crypto from 'crypto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

function generateHash(payload: any): string {
  const sortedPayload = Object.keys(payload)
    .sort()
    .reduce((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {} as any);
  return crypto.createHash('sha256').update(JSON.stringify(sortedPayload)).digest('hex');
}

@ApiTags('Payments')
@ApiBearerAuth('API-Key')
@Controller('payments')
@UseGuards(ApiAuthGuard)
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @ApiOperation({ summary: 'Create a new payment (Idempotent)' })
  @Post()
  async createPayment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentDto,
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
    const requestHash = generateHash(dto);

    const result = await this.idempotencyService.executeIdempotent(
      merchantId,
      idempotencyKey,
      requestHash,
      '/payments',
      async (manager) => {
        const payment = await this.paymentService.createPayment(merchantId, dto, manager);
        return {
          status: 201,
          body: {
            status: 'success',
            data: payment,
          },
        };
      },
    );

    res.status(result.status);
    return result.body;
  }

  @Get()
  async listPayments(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    const merchantId = req.merchant.merchantId;
    const [payments, total] = await this.paymentService.listPayments(merchantId, limit, offset);

    return {
      status: 'success',
      data: payments,
      meta: {
        limit,
        offset,
        total,
      },
    };
  }

  @Post(':id/process')
  async processPayment(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
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
    const requestHash = generateHash({ action: 'process', paymentId: id });

    const result = await this.idempotencyService.executeIdempotent(
      merchantId,
      idempotencyKey,
      requestHash,
      `/payments/${id}/process`,
      async (manager) => {
        const payment = await this.paymentService.processPayment(merchantId, id, manager);
        return {
          status: 201,
          body: {
            status: 'success',
            data: payment,
          },
        };
      },
    );

    res.status(result.status);
    return result.body;
  }

  @Get(':id')
  async getPayment(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const merchantId = req.merchant.merchantId;
    const payment = await this.paymentService.getPayment(merchantId, id);

    return {
      status: 'success',
      data: payment,
    };
  }
}
