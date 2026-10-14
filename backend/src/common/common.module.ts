import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { StructuredLoggerService } from './logger/structured-logger.service';
import { MetricsService } from './metrics/metrics.service';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

@Module({
  providers: [
    StructuredLoggerService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [StructuredLoggerService, MetricsService],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
