import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('should initialize metrics to zero', () => {
    const metrics = service.getMetrics();
    expect(metrics.httpRequests).toBe(0);
    expect(metrics.httpErrors).toBe(0);
    expect(metrics.httpRequestDurationMs).toBe(0);
    expect(metrics.paymentsCreated).toBe(0);
    expect(metrics.paymentsSucceeded).toBe(0);
    expect(metrics.paymentsFailed).toBe(0);
    expect(metrics.webhooksStarted).toBe(0);
    expect(metrics.webhooksSucceeded).toBe(0);
    expect(metrics.webhooksFailed).toBe(0);
    expect(metrics.webhookRetries).toBe(0);
  });

  it('should increment metrics correctly', () => {
    service.increment('httpRequests');
    service.increment('httpRequests');
    service.increment('httpRequestDurationMs', 150);

    const metrics = service.getMetrics();
    expect(metrics.httpRequests).toBe(2);
    expect(metrics.httpRequestDurationMs).toBe(150);
  });
});
