import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that catches ALL exceptions (not just HttpException)
 * and returns a standardized error response.
 *
 * Response format:
 * {
 *   "success": false,
 *   "statusCode": 400,
 *   "message": "Validation failed",
 *   "details": [...],           // only present for validation errors
 *   "timestamp": "...",
 *   "path": "/api/v1/..."
 * }
 *
 * Non-HTTP exceptions are logged as errors and return a generic 500 response
 * to avoid leaking internal details.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;

        // class-validator returns validation errors as message[]
        if (Array.isArray(resp.message)) {
          message = 'Validation failed';
          details = resp.message;
        } else {
          message = (resp.message as string) || message;
        }
      }
    } else {
      // Non-HTTP exceptions — log the full error but don't expose internals
      this.logger.error({
        event: 'http.request.error',
        errorCode: 'INTERNAL_ERROR',
        error: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    if (exception instanceof HttpException) {
      this.logger.warn({
        event: 'http.request.error',
        errorCode: 'CLIENT_ERROR',
        status,
        message,
      });
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: (request as any).id, // Include requestId in response body for correlation
    });
  }
}
