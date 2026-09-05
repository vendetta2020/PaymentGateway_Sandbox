import { Controller, Post, Body, Param, UseGuards, Req, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from '../services/payment.service';
import { TransitionPaymentDto } from '../dto/transition-payment.dto';
import { ApiAuthGuard } from '../../auth/guards/api-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

@Controller('internal/payments')
@UseGuards(ApiAuthGuard)
export class InternalPaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  @Post(':id/transition')
  async transitionStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: TransitionPaymentDto,
  ) {
    const isSimulationAllowed = this.configService.get<boolean>('ALLOW_DEV_PAYMENT_SIMULATION');
    if (!isSimulationAllowed) {
      throw new NotFoundException();
    }

    const merchantId = req.merchant.merchantId;
    const payment = await this.paymentService.transitionStatus(merchantId, id, dto.status);

    return {
      status: 'success',
      data: payment,
    };
  }
}
