import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

import { AppLogger } from '../logger/logger.service';
import { RequestContextService } from '../logger/request-context.service';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(
    private readonly context: RequestContextService,
    private readonly logger: AppLogger,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const requestId = Array.isArray(incoming)
      ? String(incoming[0])
      : (incoming ?? randomUUID());

    res.setHeader('x-request-id', requestId);

    const start = Date.now();
    this.context.run({ requestId, ip: req.ip }, () => {
      res.on('finish', () => {
        this.logger.info('request completed', {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
        });
      });
      next();
    });
  }
}
