import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MailerService } from './mailer.service';
import { NotificationService } from './notification.service';
import {
  NotificationOutbox,
  NotificationOutboxSchema,
} from './notification-outbox.schema';
import {
  ChatMessage,
  ChatMessageSchema,
} from '../../chats/schemas/message.schema';
import { WhatsAppModule } from '../../whatsapp/whatsapp.module';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';
import { NotificationDeliveriesController } from './notification-deliveries.controller';
import {
  MessageStatusEvent,
  MessageStatusEventSchema,
} from '../../chats/schemas/message-status.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationOutbox.name, schema: NotificationOutboxSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: MessageStatusEvent.name, schema: MessageStatusEventSchema },
    ]),
    WhatsAppModule,
    AuditLogsModule,
  ],
  controllers: [NotificationDeliveriesController],
  providers: [MailerService, NotificationService],
  exports: [NotificationService, MailerService],
})
export class NotificationsModule {}
