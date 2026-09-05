import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from './entities/merchant.entity';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { PaginationDto } from './dto/pagination.dto';
import { MerchantStatus } from './enums/merchant-status.enum';

export interface PaginatedMerchantsResponse {
  data: Merchant[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);

  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
  ) {}

  /**
   * Creates a new merchant after ensuring email uniqueness.
   * Merchant status is strictly controlled by the server (defaulting to ACTIVE).
   */
  async create(createMerchantDto: CreateMerchantDto): Promise<Merchant> {
    const normalizedEmail = createMerchantDto.email.trim().toLowerCase();

    // Application-level check
    const existing = await this.merchantRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('Merchant with this email already exists');
    }

    const merchant = this.merchantRepository.create({
      name: createMerchantDto.name.trim(),
      businessName: createMerchantDto.businessName.trim(),
      email: normalizedEmail,
      status: MerchantStatus.ACTIVE,
    });

    try {
      const saved = await this.merchantRepository.save(merchant);
      this.logger.log(`Created merchant id=${saved.id}, email=${saved.email}`);
      return saved;
    } catch (error: unknown) {
      // PostgreSQL unique violation code 23505 (handles race conditions)
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new ConflictException('Merchant with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Retrieves a single merchant by its UUID.
   */
  async findById(id: string): Promise<Merchant> {
    const merchant = await this.merchantRepository.findOne({
      where: { id },
    });

    if (!merchant) {
      throw new NotFoundException(`Merchant with ID "${id}" not found`);
    }

    return merchant;
  }

  /**
   * Retrieves merchants with bounded pagination.
   */
  async findAll(paginationDto?: PaginationDto): Promise<PaginatedMerchantsResponse> {
    const limit = paginationDto?.limit ?? 20;
    const offset = paginationDto?.offset ?? 0;

    const [data, total] = await this.merchantRepository.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      data,
      meta: {
        total,
        limit,
        offset,
      },
    };
  }
}
