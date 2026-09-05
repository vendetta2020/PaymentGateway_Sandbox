import { Controller, Post, Body, Param, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { TransitionPaymentDto } from '../dto/transition-payment.dto';
import { ApiAuthGuard } from '../../auth/guards/api-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

@Controller('internal/payments')
@UseGuards(ApiAuthGuard)
export class InternalPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':id/transition')
  async transitionStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: TransitionPaymentDto,
  ) {
    const merchantId = req.merchant.merchantId;
    const payment = await this.paymentService.transitionStatus(merchantId, id, dto.status);
    
    return {
      status: 'success',
      data: payment,
    };
  }
}
