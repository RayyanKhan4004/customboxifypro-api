import { Controller, Get, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { Public } from '../common/decorators/decorators';
import { CacheService } from '../cache/cache.service';
import { RedisConfig } from '../config/redis.config';

interface HealthStatus {
  status: 'ok' | 'error';
  components: Record<string, 'ok' | 'error'>;
}

@Injectable()
export class ReadinessService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly cache: CacheService,
    private readonly redisConfig: RedisConfig,
  ) {}

  async check(): Promise<HealthStatus> {
    const mongoOk = await this.pingMongo();
    const redisOk = this.redisConfig.enabled ? await this.cache.ping() : true;

    return {
      status: mongoOk && redisOk ? 'ok' : 'error',
      components: {
        mongodb: mongoOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
      },
    };
  }

  private async pingMongo(): Promise<boolean> {
    try {
      await this.connection.db?.admin().ping();
      return true;
    } catch {
      return false;
    }
  }
}

@Controller('health')
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get('live')
  @Public()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  async ready(): Promise<HealthStatus> {
    return this.readiness.check();
  }
}
