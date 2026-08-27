import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { Queues } from '../common/constants/queues';
import { ImageProcessingService } from './image-processing.service';

interface ImageProcessingJobData {
  mediaId: string;
  key: string;
}

/**
 * Queue-backed adapter for image processing. When Redis is disabled, the
 * same ImageProcessingService runs in-process from MediaService instead.
 */
@Processor(Queues.imageProcessing, { concurrency: 2 })
export class ImageProcessingProcessor extends WorkerHost {
  constructor(private readonly imageProcessing: ImageProcessingService) {
    super();
  }

  async process(job: Job<ImageProcessingJobData>): Promise<void> {
    await this.imageProcessing.process(job.data.mediaId, job.data.key);
  }
}
