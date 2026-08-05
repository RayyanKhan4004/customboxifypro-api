import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

import { RedisConfig } from '../config/redis.config';
import { AppLogger } from '../common/logger/logger.service';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    private readonly config: RedisConfig,
    private readonly logger: AppLogger,
  ) {
    this.client = new Redis(config.url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });
    this.client.on('error', (error) => {
      this.logger.warn('redis error', { message: error.message });
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  get raw(): Redis {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlMs && ttlMs > 0) {
      await this.client.set(key, serialized, 'PX', ttlMs);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  /** Read (and lazily create) the version counter for a write-namespace. */
  async namespaceVersion(namespace: string): Promise<number> {
    const key = `ns:version:${namespace}`;
    const value = await this.client.get(key);
    if (value !== null) return Number(value);
    await this.client.set(key, '1');
    return 1;
  }

  /** Invalidate a namespace by bumping its version. Callers embed the version in keys. */
  async bumpNamespace(namespace: string): Promise<number> {
    const key = `ns:version:${namespace}`;
    return this.client.incr(key);
  }

  async setSessionMarker(sessionId: string, ttlMs: number): Promise<void> {
    await this.client.set(`session:${sessionId}`, '1', 'PX', ttlMs);
  }

  async incrementCounter(key: string, ttlMs: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.pexpire(key, ttlMs);
    }
    return count;
  }

  async sessionMarkerExists(sessionId: string): Promise<boolean> {
    return (await this.client.exists(`session:${sessionId}`)) === 1;
  }

  async revokeSessionMarker(sessionId: string): Promise<void> {
    await this.client.del(`session:${sessionId}`);
  }
}
