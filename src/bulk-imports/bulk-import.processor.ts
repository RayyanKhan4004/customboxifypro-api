import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { Queues } from '../common/constants/queues';
import { BulkImportService } from './bulk-import.service';

interface BulkImportJobData {
  importId: string;
}

@Processor(Queues.bulkImport, { concurrency: 2 })
export class BulkImportProcessor extends WorkerHost {
  constructor(private readonly service: BulkImportService) {
    super();
  }

  async process(job: Job<BulkImportJobData>): Promise<void> {
    await this.service.runImport(job.data.importId);
  }
}
