import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { Queues } from '../../common/constants/queues';
import { AppLogger } from '../../common/logger/logger.service';
import { MailerService, MailMessage } from './mailer.service';

type EmailJobData = MailMessage;

// Decorator options are the only place BullMQ concurrency can be set; DI is not
// available at decoration time, so read the validated env var directly.
@Processor(Queues.notifications, {
  concurrency: Number(process.env.JOBS_NOTIFICATION_CONCURRENCY ?? 1) || 1,
})
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly mailer: MailerService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    await this.mailer.send({
      to: job.data.to,
      subject: job.data.subject,
      html: job.data.html,
      text: job.data.text,
    });
    this.logger.info('notification job processed', { jobId: job.id });
  }
}
