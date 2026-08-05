import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { RedisConfig } from '../config/redis.config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [RedisConfig],
      useFactory: (redis: RedisConfig) => ({
        connection: { url: redis.url },
        defaultJobOptions: {
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      }),
    }),
  ],
})
export class JobsModule {}
