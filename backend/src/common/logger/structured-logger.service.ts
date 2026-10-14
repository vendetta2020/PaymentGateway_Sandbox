import { LoggerService, Injectable } from '@nestjs/common';
import { loggerContext } from './logger.context';

@Injectable()
export class StructuredLoggerService implements LoggerService {
  log(message: any, ...optionalParams: any[]) {
    this.printLog('info', message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.printLog('error', message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.printLog('warn', message, optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.printLog('debug', message, optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.printLog('verbose', message, optionalParams);
  }

  private printLog(level: string, message: any, optionalParams: any[]) {
    let payload: any = {};
    if (typeof message === 'object' && message !== null) {
      payload = { ...message };
    } else {
      payload.message = String(message);
    }

    // Optional params can contain context or error stacks
    if (optionalParams && optionalParams.length > 0) {
      if (optionalParams.length === 1 && typeof optionalParams[0] === 'string') {
        payload.context = optionalParams[0];
      } else {
        payload.params = optionalParams;
      }
    }

    const ctx = loggerContext.getStore();
    if (ctx) {
      if (ctx.requestId) payload.requestId = ctx.requestId;
      if (ctx.merchantId) payload.merchantId = ctx.merchantId;
    }

    payload.level = level;
    payload.timestamp = new Date().toISOString();
    payload.service = 'payment-gateway';

    // Redact
    payload = this.redact(payload);

    // Write JSON to stdout
    if (level === 'error') {
      console.error(JSON.stringify(payload));
    } else {
      console.log(JSON.stringify(payload));
    }
  }

  private redact(obj: any): any {
    if (obj instanceof Error) {
      return this.redact({
        name: obj.name,
        message: obj.message,
        stack: obj.stack,
      });
    }

    if (typeof obj === 'string') {
      return obj
        .replace(/Bearer\s+[A-Za-z0-9\-\._~+\/]+=*/gi, 'Bearer [REDACTED]')
        .replace(/(sk_live_|sk_test_|whsec_)[a-zA-Z0-9_]+/g, '$1[REDACTED]');
    }

    if (typeof obj !== 'object' || obj === null) return obj;

    if (Array.isArray(obj)) {
      return obj.map((v) => this.redact(v));
    }

    const redacted = { ...obj };
    const sensitiveKeyPattern =
      /(password|secret|authorization|bearer|token|cvv|cardnumber|primaryaccountnumber|^pan$)/i;

    for (const key of Object.keys(redacted)) {
      const normalizedKey = key.replace(/[-_]/g, '').toLowerCase();

      if (sensitiveKeyPattern.test(normalizedKey)) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = this.redact(redacted[key]);
      }
    }
    return redacted;
  }
}
