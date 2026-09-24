import { MODULE_METADATA } from '@nestjs/common/constants';

import { JobsModule } from './jobs.module';
import { MediaModule } from '../media/media.module';
import { BulkImportsModule } from '../bulk-imports/bulk-imports.module';
import { NotificationsModule } from './notifications/notifications.module';

describe('Redis-disabled module wiring', () => {
  it('does not register BullMQ when REDIS_ENABLED is false', () => {
    expect(process.env.REDIS_ENABLED).not.toBe('true');
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, JobsModule)).toEqual(
      [],
    );
    for (const moduleType of [
      MediaModule,
      BulkImportsModule,
      NotificationsModule,
    ]) {
      const imports = Reflect.getMetadata(
        MODULE_METADATA.IMPORTS,
        moduleType,
      ) as Array<{ module?: { name?: string } }>;
      expect(
        imports.some((entry) => entry?.module?.name?.includes('Bull')),
      ).toBe(false);
    }
  });
});
