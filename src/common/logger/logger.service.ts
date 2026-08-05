import { Injectable, Scope } from '@nestjs/common';

import { AppConfig } from '../../config/app.config';
import { RequestContextService } from './request-context.service';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger {
  constructor(
    private readonly appConfig: AppConfig,
    private readonly context: RequestContextService,
  ) {}

  private emit(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const requestId = this.context.requestId();
    const time = new Date().toISOString();
    const base = { level, time, message, requestId };

    if (this.appConfig.isProduction) {
      const line = JSON.stringify(meta ? { ...base, ...meta } : base);
      if (level === 'error') console.error(line);
      else if (level === 'warn') console.warn(line);
      else console.log(line);
      return;
    }

    const prefix = `[${time}] ${level.toUpperCase().padEnd(5)} ${requestId}`;
    const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
    if (level === 'error') console.error(`${prefix} ${message}${suffix}`);
    else if (level === 'warn') console.warn(`${prefix} ${message}${suffix}`);
    else console.log(`${prefix} ${message}${suffix}`);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.emit('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.emit('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.emit('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>, trace?: string): void {
    const payload: Record<string, unknown> = { ...meta };
    if (trace) payload.stack = trace;
    this.emit('error', message, payload);
  }
}
