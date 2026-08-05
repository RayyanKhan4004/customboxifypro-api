import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppConfig } from './app.config';
import { AuthConfig } from './auth.config';
import { DatabaseConfig } from './database.config';
import { JobsConfig } from './jobs.config';
import { MediaConfig } from './media.config';
import { R2Config } from './r2.config';
import { RedisConfig } from './redis.config';
import { validateEnv } from './env.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
  providers: [
    AppConfig,
    AuthConfig,
    DatabaseConfig,
    R2Config,
    RedisConfig,
    MediaConfig,
    JobsConfig,
  ],
  exports: [
    AppConfig,
    AuthConfig,
    DatabaseConfig,
    R2Config,
    RedisConfig,
    MediaConfig,
    JobsConfig,
  ],
})
export class ConfigurationModule {}
