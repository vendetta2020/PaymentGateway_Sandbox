import { Controller, Post, Get, Body, Param, UseGuards, Req, ParseUUIDPipe, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { ApiAuthGuard } from '../../auth/guards/api-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

@Controller('payments')
@UseGuards(ApiAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createPayment(@Req() req: AuthenticatedRequest, @Body() dto: CreatePaymentDto) {
    const merchantId = req.merchant.merchantId;
    const payment = await this.paymentService.createPayment(merchantId, dto);

    return {
      status: 'success',
      data: payment,
    };
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
      }
    };
  }

  @Post(':id/process')
  async processPayment(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const merchantId = req.merchant.merchantId;
    const payment = await this.paymentService.processPayment(merchantId, id);
    
    return {
      status: 'success',
      data: payment,
    };
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
