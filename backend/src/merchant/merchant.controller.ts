import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MerchantService, PaginatedMerchantsResponse } from './merchant.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { PaginationDto } from './dto/pagination.dto';
import { Merchant } from './entities/merchant.entity';

/**
 * Controller exposing internal development endpoints for the Merchant domain.
 *
 * NOTE: Authentication and API keys are intentionally omitted in this phase.
 * These endpoints serve domain verification and foundation testing.
 */
@Controller('merchants')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createMerchantDto: CreateMerchantDto): Promise<Merchant> {
    return this.merchantService.create(createMerchantDto);
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<Merchant> {
    return this.merchantService.findById(id);
  }

  @Get()
  async findAll(@Query() paginationDto: PaginationDto): Promise<PaginatedMerchantsResponse> {
    return this.merchantService.findAll(paginationDto);
  }
}
