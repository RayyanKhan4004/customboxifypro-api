import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { Queues } from '../../common/constants/queues';
import { AppLogger } from '../../common/logger/logger.service';
import { JobsConfig } from '../../config/jobs.config';
import { MailerService, MailMessage } from './mailer.service';

type EmailJobData = MailMessage;

@Processor(Queues.notifications, { concurrency: 0 })
export class NotificationProcessor extends WorkerHost {
  private readonly concurrency: number;

  constructor(
    private readonly mailer: MailerService,
    private readonly logger: AppLogger,
    jobsConfig: JobsConfig,
  ) {
    super();
    this.concurrency = jobsConfig.notificationConcurrency;
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
