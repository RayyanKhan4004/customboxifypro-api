import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MediaModule } from '../media/media.module';
import { ChatsModule } from '../chats/chats.module';
import { NotificationsModule } from '../jobs/notifications/notifications.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
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
    MediaModule,
    ChatsModule,
    NotificationsModule,
    InAppNotificationsModule,
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
