import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, QueryFailedError } from 'typeorm';
import { ReconciliationRun } from '../entities/reconciliation-run.entity';
import { ReconciliationResult } from '../entities/reconciliation-result.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { ReconciliationStatus } from '../enums/reconciliation-status.enum';
import { ReconciliationDiscrepancyType } from '../enums/reconciliation-discrepancy-type.enum';
import { PaymentStatus } from '../../payment/enums/payment-status.enum';
import {
  PaymentProvider,
  ProviderTransactionRecord,
} from '../../payment/providers/payment-provider.interface';
import { CreateReconciliationDto } from '../dto/create-reconciliation.dto';

@Injectable()
export class ReconciliationService {
  constructor(
    @InjectRepository(ReconciliationRun)
    private readonly runRepository: Repository<ReconciliationRun>,
    @InjectRepository(ReconciliationResult)
    private readonly resultRepository: Repository<ReconciliationResult>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @Inject('PAYMENT_PROVIDER')
    private readonly paymentProvider: PaymentProvider,
  ) {}

  /**
   * Executes an idempotent reconciliation run comparing internal payments
   * with external provider transaction records.
   *
   * STRICT FINANCIAL RULE: This method NEVER mutates internal payment records.
   */
  async runReconciliation(
    merchantId: string,
    dto: CreateReconciliationDto,
  ): Promise<ReconciliationRun> {
    const periodStartDate = new Date(dto.periodStart);
    const periodEndDate = new Date(dto.periodEnd);

    if (isNaN(periodStartDate.getTime()) || isNaN(periodEndDate.getTime())) {
      throw new BadRequestException('Invalid date format for periodStart or periodEnd');
    }

    if (periodEndDate.getTime() < periodStartDate.getTime()) {
      throw new BadRequestException('periodEnd must be greater than or equal to periodStart');
    }

    // 1. Idempotency check: return existing completed run if already generated
    const existingRun = await this.runRepository.findOne({
      where: {
        merchantId,
        periodStart: periodStartDate,
        periodEnd: periodEndDate,
      },
      relations: { results: true },
    });

    if (existingRun && existingRun.status === ReconciliationStatus.COMPLETED) {
      return existingRun;
    }

    // 2. Initialize or claim the reconciliation run record
    let run = existingRun;
    if (!run) {
      const newRun = this.runRepository.create({
        merchantId,
        periodStart: periodStartDate,
        periodEnd: periodEndDate,
        status: ReconciliationStatus.RUNNING,
      });

      try {
        run = await this.runRepository.save(newRun);
      } catch (error) {
        if (error instanceof QueryFailedError && (error as any).code === '23505') {
          // Concurrent request created it first!
          // Poll or fetch the winning run
          let winner = await this.runRepository.findOne({
            where: {
              merchantId,
              periodStart: periodStartDate,
              periodEnd: periodEndDate,
            },
            relations: { results: true },
          });

          let attempts = 0;
          while ((!winner || winner.status === ReconciliationStatus.RUNNING) && attempts < 30) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            winner = await this.runRepository.findOne({
              where: {
                merchantId,
                periodStart: periodStartDate,
                periodEnd: periodEndDate,
              },
              relations: { results: true },
            });
            attempts++;
          }

          if (winner) {
            return winner;
          }
        }
        throw error;
      }
    } else {
      run.status = ReconciliationStatus.RUNNING;
      run = await this.runRepository.save(run);
    }

    // 3. Load eligible internal transactions
    const payments = await this.paymentRepository.find({
      where: {
        merchantId,
        status: PaymentStatus.SUCCEEDED,
        createdAt: Between(periodStartDate, periodEndDate),
      },
      order: { createdAt: 'ASC' },
    });

    // 4. Load provider records from simulator
    let providerRecords: ProviderTransactionRecord[] = [];
    try {
      providerRecords = await this.paymentProvider.getTransactions(
        merchantId,
        periodStartDate,
        periodEndDate,
        dto.scenario || 'PERFECT_MATCH',
      );
    } catch (error) {
      run.status = ReconciliationStatus.FAILED;
      await this.runRepository.save(run);
      throw error;
    }

    // 5. Detect duplicate provider references in provider records
    const providerRefCounts = new Map<string, number>();
    for (const rec of providerRecords) {
      if (rec.providerReference) {
        providerRefCounts.set(
          rec.providerReference,
          (providerRefCounts.get(rec.providerReference) || 0) + 1,
        );
      }
    }

    // 6. Execute deterministic reconciliation comparison algorithm
    const matchedProviderIndices = new Set<number>();
    const results: ReconciliationResult[] = [];
    let totalInternalAmount = 0;
    let totalProviderAmount = 0;
    let matchedCount = 0;
    let discrepancyCount = 0;

    // A. Match each internal payment against provider records
    for (const p of payments) {
      const pAmount = Number(p.amount);
      totalInternalAmount += pAmount;
      const ref = p.providerReference;

      const providerIdx = providerRecords.findIndex(
        (r, idx) => !matchedProviderIndices.has(idx) && r.providerReference === ref,
      );

      if (providerIdx === -1) {
        // Missing in provider
        discrepancyCount++;
        results.push(
          this.resultRepository.create({
            reconciliationRunId: run.id,
            providerReference: ref,
            paymentId: p.id,
            discrepancyType: ReconciliationDiscrepancyType.MISSING_IN_PROVIDER,
            internalAmount: pAmount,
            providerAmount: null,
            internalCurrency: p.currency,
            providerCurrency: null,
            internalStatus: p.status,
            providerStatus: null,
            details: 'Transaction found in internal system but missing in provider records',
          }),
        );
      } else {
        matchedProviderIndices.add(providerIdx);
        const prov = providerRecords[providerIdx];
        totalProviderAmount += prov.amount;

        const isDuplicateRef = (providerRefCounts.get(ref!) || 0) > 1;

        if (isDuplicateRef) {
          discrepancyCount++;
          results.push(
            this.resultRepository.create({
              reconciliationRunId: run.id,
              providerReference: ref,
              paymentId: p.id,
              discrepancyType: ReconciliationDiscrepancyType.DUPLICATE_PROVIDER_REFERENCE,
              internalAmount: pAmount,
              providerAmount: prov.amount,
              internalCurrency: p.currency,
              providerCurrency: prov.currency,
              internalStatus: p.status,
              providerStatus: prov.providerStatus,
              details: 'Duplicate provider reference encountered in provider records',
            }),
          );
        } else if (pAmount !== prov.amount) {
          discrepancyCount++;
          results.push(
            this.resultRepository.create({
              reconciliationRunId: run.id,
              providerReference: ref,
              paymentId: p.id,
              discrepancyType: ReconciliationDiscrepancyType.AMOUNT_MISMATCH,
              internalAmount: pAmount,
              providerAmount: prov.amount,
              internalCurrency: p.currency,
              providerCurrency: prov.currency,
              internalStatus: p.status,
              providerStatus: prov.providerStatus,
              details: `Amount mismatch: internal ${pAmount} vs provider ${prov.amount}`,
            }),
          );
        } else if (p.currency !== prov.currency) {
          discrepancyCount++;
          results.push(
            this.resultRepository.create({
              reconciliationRunId: run.id,
              providerReference: ref,
              paymentId: p.id,
              discrepancyType: ReconciliationDiscrepancyType.CURRENCY_MISMATCH,
              internalAmount: pAmount,
              providerAmount: prov.amount,
              internalCurrency: p.currency,
              providerCurrency: prov.currency,
              internalStatus: p.status,
              providerStatus: prov.providerStatus,
              details: `Currency mismatch: internal ${p.currency} vs provider ${prov.currency}`,
            }),
          );
        } else if (prov.providerStatus !== 'SUCCESS') {
          discrepancyCount++;
          results.push(
            this.resultRepository.create({
              reconciliationRunId: run.id,
              providerReference: ref,
              paymentId: p.id,
              discrepancyType: ReconciliationDiscrepancyType.STATUS_MISMATCH,
              internalAmount: pAmount,
              providerAmount: prov.amount,
              internalCurrency: p.currency,
              providerCurrency: prov.currency,
              internalStatus: p.status,
              providerStatus: prov.providerStatus,
              details: `Status mismatch: internal ${p.status} vs provider ${prov.providerStatus}`,
            }),
          );
        } else {
          matchedCount++;
          results.push(
            this.resultRepository.create({
              reconciliationRunId: run.id,
              providerReference: ref,
              paymentId: p.id,
              discrepancyType: ReconciliationDiscrepancyType.MATCHED,
              internalAmount: pAmount,
              providerAmount: prov.amount,
              internalCurrency: p.currency,
              providerCurrency: prov.currency,
              internalStatus: p.status,
              providerStatus: prov.providerStatus,
              details: 'Transaction matched perfectly',
            }),
          );
        }
      }
    }

    // B. Check for provider transactions missing internally
    for (let i = 0; i < providerRecords.length; i++) {
      if (!matchedProviderIndices.has(i)) {
        const prov = providerRecords[i];
        totalProviderAmount += prov.amount;
        discrepancyCount++;
        results.push(
          this.resultRepository.create({
            reconciliationRunId: run.id,
            providerReference: prov.providerReference,
            paymentId: null,
            discrepancyType: ReconciliationDiscrepancyType.MISSING_IN_INTERNAL,
            internalAmount: null,
            providerAmount: prov.amount,
            internalCurrency: null,
            providerCurrency: prov.currency,
            internalStatus: null,
            providerStatus: prov.providerStatus,
            details: 'Transaction found in provider records but missing in internal system',
          }),
        );
      }
    }

    // 7. Persist results and complete reconciliation run atomically
    run.totalInternalAmount = totalInternalAmount;
    run.totalProviderAmount = totalProviderAmount;
    run.matchedCount = matchedCount;
    run.discrepancyCount = discrepancyCount;
    run.status = ReconciliationStatus.COMPLETED;
    run.completedAt = new Date();

    await this.runRepository.save(run);
    const savedResults = await this.resultRepository.save(results);
    run.results = savedResults;

    return run;
  }

  async getReconciliation(merchantId: string, id: string): Promise<ReconciliationRun> {
    const run = await this.runRepository.findOne({
      where: { id, merchantId },
      relations: { results: true },
    });

    if (!run) {
      throw new NotFoundException('Reconciliation run not found');
    }

    return run;
  }

  async getReconciliationResults(merchantId: string, id: string): Promise<ReconciliationResult[]> {
    const run = await this.getReconciliation(merchantId, id);
    return run.results || [];
  }

  async listReconciliations(
    merchantId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<[ReconciliationRun[], number]> {
    return this.runRepository.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}
