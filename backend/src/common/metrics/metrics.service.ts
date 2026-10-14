import { Injectable } from '@nestjs/common';

export interface OperationalMetrics {
  httpRequests: number;
  httpErrors: number;
  httpRequestDurationMs: number;
  paymentsCreated: number;
  paymentsSucceeded: number;
  paymentsFailed: number;
  webhooksStarted: number;
  webhooksSucceeded: number;
  webhooksFailed: number;
  webhookRetries: number;
}

@Injectable()
export class MetricsService {
  private metrics: OperationalMetrics = {
    httpRequests: 0,
    httpErrors: 0,
    httpRequestDurationMs: 0,
    paymentsCreated: 0,
    paymentsSucceeded: 0,
    paymentsFailed: 0,
    webhooksStarted: 0,
    webhooksSucceeded: 0,
    webhooksFailed: 0,
    webhookRetries: 0,
  };

  increment(metric: keyof OperationalMetrics, value = 1) {
    this.metrics[metric] += value;
  }

  getMetrics(): OperationalMetrics {
    return { ...this.metrics };
  }
}
