import { Controller, Post, Get, Body, Param, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
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
  async listPayments(@Req() req: AuthenticatedRequest) {
    const merchantId = req.merchant.merchantId;
    const payments = await this.paymentService.listPayments(merchantId);
    
    return {
      status: 'success',
      data: payments,
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
