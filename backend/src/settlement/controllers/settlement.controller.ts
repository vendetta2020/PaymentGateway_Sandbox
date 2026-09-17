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
import { SettlementService } from '../services/settlement.service';
import { CreateSettlementDto } from '../dto/create-settlement.dto';
import { ApiAuthGuard } from '../../auth/guards/api-auth.guard';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Settlements')
@ApiBearerAuth('API-Key')
@Controller('settlements')
@UseGuards(ApiAuthGuard)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post()
  async createSettlement(@Req() req: AuthenticatedRequest, @Body() dto: CreateSettlementDto) {
    const merchantId = req.merchant.merchantId;
    const settlement = await this.settlementService.createSettlement(merchantId, dto);

    return {
      status: 'success',
      data: settlement,
    };
  }

  @Get(':id')
  async getSettlement(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const merchantId = req.merchant.merchantId;
    const settlement = await this.settlementService.getSettlement(merchantId, id);

    return {
      status: 'success',
      data: settlement,
    };
  }

  @Get()
  async listSettlements(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    const merchantId = req.merchant.merchantId;
    const [settlements, total] = await this.settlementService.listSettlements(
      merchantId,
      limit,
      offset,
    );

    return {
      status: 'success',
      data: settlements,
      meta: {
        total,
        limit,
        offset,
      },
    };
  }
}
