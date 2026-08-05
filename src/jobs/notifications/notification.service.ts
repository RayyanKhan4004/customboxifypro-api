import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { Queues } from '../../common/constants/queues';

export interface EmailNotificationData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectQueue(Queues.notifications) private readonly queue: Queue,
  ) {}

  async sendEmail(data: EmailNotificationData): Promise<void> {
    await this.queue.add('send-email', data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { count: 1000 },
    });
  }
}
