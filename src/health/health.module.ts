import { Module } from '@nestjs/common';

import { HealthController, ReadinessService } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [ReadinessService],
})
export class HealthModule {}
