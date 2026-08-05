import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import {
  AdminCustomerRequestsController,
  PublicCustomerRequestsController,
} from './customer-requests.controller';
import { CustomerRequestsService } from './customer-requests.service';
import { SpamGuardService } from './spam-guard.service';
import { CustomerRequestRepository } from './repositories/customer-request.repository';
import {
  CustomerRequest,
  CustomerRequestSchema,
} from './schemas/customer-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomerRequest.name, schema: CustomerRequestSchema },
    ]),
    AuditLogsModule,
  ],
  controllers: [
    AdminCustomerRequestsController,
    PublicCustomerRequestsController,
  ],
  providers: [
    CustomerRequestsService,
    CustomerRequestRepository,
    SpamGuardService,
  ],
  exports: [CustomerRequestsService],
})
export class CustomerRequestsModule {}
