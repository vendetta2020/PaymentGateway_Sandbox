import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Settlement } from '../entities/settlement.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { Refund } from '../../refund/entities/refund.entity';
import { SettlementStatus } from '../enums/settlement-status.enum';
import { PaymentStatus } from '../../payment/enums/payment-status.enum';
import { RefundStatus } from '../../refund/enums/refund-status.enum';
import { CreateSettlementDto } from '../dto/create-settlement.dto';
import * as crypto from 'crypto';

@Injectable()
export class SettlementService {
  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepository: Repository<Settlement>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
  ) {}

  /**
   * Generates a deterministic settlement for a merchant and time period.
   * Idempotent per (merchantId, periodStart, periodEnd, currency).
   */
  async createSettlement(merchantId: string, dto: CreateSettlementDto): Promise<Settlement> {
    const periodStartDate = new Date(dto.periodStart);
    const periodEndDate = new Date(dto.periodEnd);

    if (isNaN(periodStartDate.getTime()) || isNaN(periodEndDate.getTime())) {
      throw new BadRequestException('Invalid date format for periodStart or periodEnd');
    }

    if (periodEndDate.getTime() < periodStartDate.getTime()) {
      throw new BadRequestException('periodEnd must be greater than or equal to periodStart');
    }

    const currency = (dto.currency || 'IDR').toUpperCase();

    // 1. Idempotency check: reuse existing settlement if already generated
    const existing = await this.settlementRepository.findOne({
      where: {
        merchantId,
        periodStart: periodStartDate,
        periodEnd: periodEndDate,
        currency,
      },
    });

    if (existing) {
      return existing;
    }

    // 2. Calculate gross amount from authoritative SUCCEEDED payments
    const paymentSumResult = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.merchantId = :merchantId', { merchantId })
      .andWhere('payment.currency = :currency', { currency })
      .andWhere('payment.status = :status', { status: PaymentStatus.SUCCEEDED })
      .andWhere('payment.createdAt >= :start AND payment.createdAt <= :end', {
        start: periodStartDate,
        end: periodEndDate,
      })
      .getRawOne();

    const grossAmount = parseInt(paymentSumResult.total, 10);

    // 3. Calculate refund amount from authoritative SUCCESS refunds
    const refundSumResult = await this.refundRepository
      .createQueryBuilder('refund')
      .select('COALESCE(SUM(refund.amount), 0)', 'total')
      .where('refund.merchantId = :merchantId', { merchantId })
      .andWhere('refund.currency = :currency', { currency })
      .andWhere('refund.status = :status', { status: RefundStatus.SUCCESS })
      .andWhere('refund.createdAt >= :start AND refund.createdAt <= :end', {
        start: periodStartDate,
        end: periodEndDate,
      })
      .getRawOne();

    const refundAmount = parseInt(refundSumResult.total, 10);

    // 4. Calculate net amount (can be negative when cross-period refunds exceed period gross)
    const netAmount = grossAmount - refundAmount;

    const settlementReference = `stl_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;

    const settlement = this.settlementRepository.create({
      merchantId,
      currency,
      grossAmount,
      refundAmount,
      netAmount,
      status: SettlementStatus.PENDING,
      settlementReference,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
    });

    try {
      return await this.settlementRepository.save(settlement);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        // Race condition: another concurrent transaction created it first!
        const winningSettlement = await this.settlementRepository.findOne({
          where: {
            merchantId,
            periodStart: periodStartDate,
            periodEnd: periodEndDate,
            currency,
          },
        });
        if (winningSettlement) {
          return winningSettlement;
        }
      }
      throw error;
    }
  }

  async getSettlement(merchantId: string, id: string): Promise<Settlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id, merchantId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    return settlement;
  }

  async listSettlements(
    merchantId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<[Settlement[], number]> {
    return this.settlementRepository.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Transitions settlement status strictly enforcing immutability once SETTLED.
   */
  async transitionStatus(
    merchantId: string,
    id: string,
    newStatus: SettlementStatus,
  ): Promise<Settlement> {
    const settlement = await this.getSettlement(merchantId, id);

    // Financial Immutability Rule: SETTLED records cannot be modified
    if (settlement.status === SettlementStatus.SETTLED) {
      throw new BadRequestException(
        'Cannot modify settled settlement: financial record is immutable',
      );
    }

    if (settlement.status === SettlementStatus.FAILED) {
      throw new BadRequestException('Cannot transition from terminal status FAILED');
    }

    if (settlement.status === newStatus) {
      return settlement;
    }

    // Valid state transitions:
    // PENDING -> PROCESSING, SETTLED, FAILED
    // PROCESSING -> SETTLED, FAILED
    const allowedTransitions: Record<SettlementStatus, SettlementStatus[]> = {
      [SettlementStatus.PENDING]: [
        SettlementStatus.PROCESSING,
        SettlementStatus.SETTLED,
        SettlementStatus.FAILED,
      ],
      [SettlementStatus.PROCESSING]: [SettlementStatus.SETTLED, SettlementStatus.FAILED],
      [SettlementStatus.SETTLED]: [],
      [SettlementStatus.FAILED]: [],
    };

    if (!allowedTransitions[settlement.status].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid settlement state transition from ${settlement.status} to ${newStatus}`,
      );
    }

    settlement.status = newStatus;
    if (newStatus === SettlementStatus.SETTLED) {
      settlement.settledAt = new Date();
    }

    return this.settlementRepository.save(settlement);
  }
}
