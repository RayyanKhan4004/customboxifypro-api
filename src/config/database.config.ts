import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseConfig {
  readonly uri: string;
  readonly databaseName: string;
  readonly poolSize: number;
  readonly queryTimeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.uri = config.get<string>('MONGODB_URI') ?? 'mongodb://localhost:27017';
    this.databaseName = config.get<string>('MONGODB_DATABASE_NAME') ?? 'boxify';
    this.poolSize = Number(config.get('MONGODB_POOL_SIZE') ?? 10);
    this.queryTimeoutMs = Number(config.get('MONGODB_QUERY_TIMEOUT_MS') ?? 5000);
  }
}
