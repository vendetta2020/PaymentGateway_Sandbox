import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();

    const { method, url } = req;
    const startTime = Date.now();

    this.metricsService.increment('httpRequests');

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startTime;
        const statusCode = res.statusCode;

        this.metricsService.increment('httpRequestDurationMs', durationMs);

        this.logger.log({
          event: 'http.request.completed',
          method,
          route: url,
          statusCode,
          durationMs,
        });
      }),
    );
  }
}
