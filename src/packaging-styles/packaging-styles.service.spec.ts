import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AuditService } from '../audit-logs/audit.service';
import { AppLogger } from '../common/logger/logger.service';
import { MediaService } from '../media/media.service';
import {
  CreatePackagingStyleDto,
  ListPublicPackagingStylesQueryDto,
} from './dto/packaging-style.dto';
import { PackagingStylesService } from './packaging-styles.service';
import { PackagingStyleRepository } from './repositories/packaging-style.repository';

describe('packaging styles without industry associations', () => {
  it('rejects industries in admin create requests', async () => {
    const dto = plainToInstance(CreatePackagingStyleDto, {
      name: 'Mailer Box',
      industries: ['food'],
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.some((error) => error.property === 'industries')).toBe(true);
  });

  it('accepts the legacy public query without exposing stored industries', async () => {
    const query = plainToInstance(ListPublicPackagingStylesQueryDto, {
      industries: 'food',
    });
    expect(
      await validate(query, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);

    const repository = {
      listActive: jest.fn().mockResolvedValue([
        {
          _id: 'style-id',
          name: 'Mailer Box',
          slug: 'mailer-box',
          description: '',
          imageKey: null,
          industries: ['food'],
          minimumOrderQuantity: null,
          deliveryTime: 'Delivery 2 weeks',
          sortOrder: 0,
          isActive: true,
        },
      ]),
    };
    const mediaService = { resolveUrls: jest.fn().mockResolvedValue({}) };
    const service = new PackagingStylesService(
      repository as unknown as PackagingStyleRepository,
      mediaService as unknown as MediaService,
      { log: jest.fn() } as unknown as AuditService,
      { info: jest.fn() } as unknown as AppLogger,
    );

    const styles = await service.listPublic();

    expect(repository.listActive).toHaveBeenCalledWith(undefined);
    expect(styles[0]).toMatchObject({ name: 'Mailer Box' });
    expect(styles[0]).not.toHaveProperty('industries');
  });
});
