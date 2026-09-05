import { Injectable, Optional } from '@nestjs/common';
import {
  PaymentProvider,
  ProviderResult,
  ProviderTransactionRecord,
} from './payment-provider.interface';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { DataSource, Between } from 'typeorm';
import * as crypto from 'crypto';

@Injectable()
export class SimulatedPaymentProvider implements PaymentProvider {
  constructor(@Optional() private readonly dataSource?: DataSource) {}

  async process(payment: Payment): Promise<ProviderResult> {
    // Deterministic simulation based on payment description or orderId
    const triggerString = `${payment.orderId} ${payment.description || ''}`.toUpperCase();

    // Simulate system error (Unexpected provider exception)
    if (triggerString.includes('SIMULATE_SYSTEM_ERROR')) {
      throw new Error('Simulated external provider connection timeout or internal error');
    }

    // Simulate business logic failure
    if (triggerString.includes('SIMULATE_FAILURE')) {
      return {
        status: 'FAILED',
        reference: `sim_fail_${crypto.randomUUID()}`,
      };
    }

    // Simulate success
    return {
      status: 'SUCCESS',
      reference: `sim_succ_${crypto.randomUUID()}`,
    };
  }

  async refund(refund: any, payment: Payment): Promise<ProviderResult> {
    // Deterministic simulation based on refund reason, payment description, or orderId
    const triggerString =
      `${refund.reason || ''} ${payment.orderId} ${payment.description || ''}`.toUpperCase();

    // Simulate system error (Unexpected provider exception)
    if (triggerString.includes('SIMULATE_SYSTEM_ERROR')) {
      throw new Error('Simulated external refund provider connection timeout or internal error');
    }

    // Simulate business logic failure
    if (triggerString.includes('SIMULATE_FAILURE')) {
      return {
        status: 'FAILED',
        reference: `ref_sim_fail_${crypto.randomUUID()}`,
      };
    }

    // Simulate success
    return {
      status: 'SUCCESS',
      reference: `ref_sim_succ_${crypto.randomUUID()}`,
    };
  }

  /**
   * Generates deterministic provider-side transaction records for a given period
   * and supports controlled reconciliation discrepancy testing scenarios.
   */
  async getTransactions(
    merchantId: string,
    periodStart: Date,
    periodEnd: Date,
    scenario: string = 'PERFECT_MATCH',
  ): Promise<ProviderTransactionRecord[]> {
    if (scenario === 'SIMULATE_SYSTEM_ERROR') {
      throw new Error('Simulated external provider connection timeout or internal error');
    }

    let payments: Payment[] = [];

    if (this.dataSource) {
      payments = await this.dataSource.getRepository(Payment).find({
        where: {
          merchantId,
          status: PaymentStatus.SUCCEEDED,
          createdAt: Between(periodStart, periodEnd),
        },
        order: { createdAt: 'ASC' },
      });
    }

    // Base records matching internal payments
    const records: ProviderTransactionRecord[] = payments.map((p) => ({
      providerReference: p.providerReference || `sim_ref_${p.id}`,
      amount: Number(p.amount),
      currency: p.currency,
      providerStatus: 'SUCCESS',
      transactionTime: p.createdAt,
    }));

    switch (scenario) {
      case 'MISSING_IN_PROVIDER':
        // Intentionally omit the first transaction so it appears missing at provider
        return records.slice(1);

      case 'MISSING_IN_INTERNAL':
        // Add a ghost transaction that exists at provider but not internally
        records.push({
          providerReference: `ref_sim_ghost_${crypto.randomUUID().substring(0, 8)}`,
          amount: 50000,
          currency: 'IDR',
          providerStatus: 'SUCCESS',
          transactionTime: new Date(periodStart.getTime() + 1000),
        });
        return records;

      case 'AMOUNT_MISMATCH':
        if (records.length > 0) {
          records[0].amount = Math.max(1, records[0].amount - 10000);
        }
        return records;

      case 'CURRENCY_MISMATCH':
        if (records.length > 0) {
          records[0].currency = records[0].currency === 'IDR' ? 'USD' : 'EUR';
        }
        return records;

      case 'STATUS_MISMATCH':
        if (records.length > 0) {
          records[0].providerStatus = 'FAILED';
        }
        return records;

      case 'DUPLICATE_PROVIDER_REFERENCE':
        if (records.length > 0) {
          records.push({ ...records[0] });
        }
        return records;

      case 'PERFECT_MATCH':
      default:
        return records;
    }
  }
}
