import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { loggerContext } from '../logger/logger.context';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let requestId = req.headers['x-request-id'] as string;

    // Validate request ID if provided (alphanumeric, dashes, limited length)
    if (requestId && !/^[a-zA-Z0-9-]{10,100}$/.test(requestId)) {
      requestId = ''; // ignore invalid request ID
    }

    if (!requestId) {
      requestId = `req_${randomUUID()}`;
    }
    (req as any).id = requestId; // attach to express request object for easy access
    res.setHeader('X-Request-Id', requestId);

    loggerContext.run({ requestId }, () => {
      next();
    });
  }
}
