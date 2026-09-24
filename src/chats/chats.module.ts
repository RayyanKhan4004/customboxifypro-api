import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import {
  CustomerRequest,
  CustomerRequestSchema,
} from '../customer-requests/schemas/customer-request.schema';
import { NotificationsModule } from '../jobs/notifications/notifications.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/message.schema';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { Admin, AdminSchema } from '../admins/schemas/admin.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import {
  MessageStatusEvent,
  MessageStatusEventSchema,
} from './schemas/message-status.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: CustomerRequest.name, schema: CustomerRequestSchema },
      { name: Admin.name, schema: AdminSchema },
      { name: Role.name, schema: RoleSchema },
      { name: MessageStatusEvent.name, schema: MessageStatusEventSchema },
    ]),
    AuditLogsModule,
    NotificationsModule,
    WhatsAppModule,
    InAppNotificationsModule,
  ],
  controllers: [ChatsController, WhatsAppWebhookController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
