import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { Queues } from '../../common/constants/queues';
import { MailerService } from './mailer.service';
import { NotificationService } from './notification.service';
import { NotificationProcessor } from './notifications.processor';

@Module({
  imports: [BullModule.registerQueue({ name: Queues.notifications })],
  providers: [MailerService, NotificationService, NotificationProcessor],
  exports: [NotificationService, MailerService],
})
export class NotificationsModule {}
