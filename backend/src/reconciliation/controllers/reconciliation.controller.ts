import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ReconciliationService } from '../services/reconciliation.service';
import { CreateReconciliationDto } from '../dto/create-reconciliation.dto';
import { ApiAuthGuard } from '../../auth/guards/api-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Reconciliations')
@ApiBearerAuth('API-Key')
@Controller('reconciliations')
@UseGuards(ApiAuthGuard)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post()
  async createReconciliation(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateReconciliationDto,
  ) {
    const merchantId = req.merchant.merchantId;
    const run = await this.reconciliationService.runReconciliation(merchantId, dto);

    return {
      status: 'success',
      data: run,
    };
  }

  @Get(':id')
  async getReconciliation(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const merchantId = req.merchant.merchantId;
    const run = await this.reconciliationService.getReconciliation(merchantId, id);

    return {
      status: 'success',
      data: run,
    };
  }

  @Get(':id/results')
  async getReconciliationResults(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const merchantId = req.merchant.merchantId;
    const results = await this.reconciliationService.getReconciliationResults(merchantId, id);

    return {
      status: 'success',
      data: results,
    };
  }

  @Get()
  async listReconciliations(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    const merchantId = req.merchant.merchantId;
    const [runs, total] = await this.reconciliationService.listReconciliations(
      merchantId,
      limit,
      offset,
    );

    return {
      status: 'success',
      data: runs,
      meta: {
        total,
        limit,
        offset,
      },
    };
  }
}
