import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseConfig {
  readonly uri: string;
  readonly databaseName: string;
  readonly poolSize: number;
  readonly queryTimeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.uri = config.get<string>('MONGODB_URI')!;
    this.databaseName = config.get<string>('MONGODB_DATABASE_NAME')!;
    this.poolSize = Number(config.get('MONGODB_POOL_SIZE'));
    this.queryTimeoutMs = Number(config.get('MONGODB_QUERY_TIMEOUT_MS'));
  }
}
