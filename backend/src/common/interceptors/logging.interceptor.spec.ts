import { LoggingInterceptor } from './logging.interceptor';
import { MetricsService } from '../metrics/metrics.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let metricsService: MetricsService;

  beforeEach(() => {
    metricsService = new MetricsService();
    interceptor = new LoggingInterceptor(metricsService);
  });

  it('should increment metrics and log on successful request', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/api/v1/test' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    const mockNext = {
      handle: () => of('test-response'),
    } as CallHandler;

    jest.spyOn(metricsService, 'increment');
    const loggerSpy = jest.spyOn((interceptor as any).logger, 'log').mockImplementation();

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: () => {
        expect(metricsService.increment).toHaveBeenCalledWith('httpRequests');
        expect(metricsService.increment).toHaveBeenCalledWith(
          'httpRequestDurationMs',
          expect.any(Number),
        );
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'http.request.completed',
            method: 'GET',
            route: '/api/v1/test',
            statusCode: 200,
          }),
        );
        done();
      },
    });
  });
});
