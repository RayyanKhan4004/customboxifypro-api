import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Types } from 'mongoose';
import { Queues } from '../common/constants/queues';
import { BulkImportService } from './bulk-import.service';

describe('BulkImportService regressions', () => {
  let service: BulkImportService;
  const parser = { parse: jest.fn() };
  const repository = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
  };
  const products = { create: jest.fn(), createManyAtomic: jest.fn() };
  const storage = { getObject: jest.fn(), putObject: jest.fn() };
  const cache = { del: jest.fn(), exists: jest.fn(), set: jest.fn() };
  const bulkQueue = { add: jest.fn() };
  const invalidateProducts = jest.fn();
  const row = { name: 'Mailer box', category: 'boxes', slug: 'mailer-box' };
  const file = {
    buffer: Buffer.from('csv'),
    originalname: 'products.csv',
  } as Express.Multer.File;

  beforeEach(async () => {
    jest.resetAllMocks();
    parser.parse.mockResolvedValue({ rows: [row], images: new Map() });
    repository.findById.mockResolvedValue({
      status: 'queued',
      mode: 'all-or-nothing',
      fileKey: 'import.csv',
      fileName: 'products.csv',
    });
    repository.create.mockResolvedValue({ _id: new Types.ObjectId() });
    cache.exists.mockResolvedValue(false);
    const mocks: Record<string, unknown> = {
      BulkImportRepository: repository,
      ImportParserService: parser,
      S3ObjectStorageService: storage,
      ProductRepository: products,
      CategoryRepository: {
        listAll: jest
          .fn()
          .mockResolvedValue([
            { slug: 'boxes', _id: new Types.ObjectId(), parentId: null },
          ]),
      },
      FilterDefinitionsService: { listActive: jest.fn().mockResolvedValue([]) },
      ProductAttributeValidator: {
        validate: jest
          .fn()
          .mockReturnValue({ attributes: new Map(), facets: [] }),
      },
      CacheService: cache,
      CacheInvalidationService: { invalidateProducts },
      AuditService: { log: jest.fn() },
      JobsConfig: {
        bulkImportBatchSize: 10,
        bulkImportMaxFileSizeBytes: 10_000,
      },
      RedisConfig: { enabled: false },
      AppLogger: { error: jest.fn(), info: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [BulkImportService],
    })
      .useMocker((token) => {
        if (token === getQueueToken(Queues.bulkImport)) return bulkQueue;
        return typeof token === 'function' ? (mocks[token.name] ?? {}) : {};
      })
      .compile();
    service = module.get(BulkImportService);
  });

  it('reports duplicate slugs on the correct spreadsheet row', async () => {
    parser.parse.mockResolvedValue({ rows: [row, row], images: new Map() });
    expect(await service.validate(file)).toMatchObject({
      valid: false,
      errorCount: 1,
      errors: [{ row: 3, field: 'slug' }],
    });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('runs imports in-process instead of using BullMQ when Redis is disabled', async () => {
    const runImport = jest.spyOn(service, 'runImport').mockResolvedValue();
    await service.create(
      { mode: 'draft' },
      { ...file, size: file.buffer.length, mimetype: 'text/csv' },
      { id: new Types.ObjectId().toString() } as never,
    );
    await Promise.resolve();

    expect(bulkQueue.add).not.toHaveBeenCalled();
    expect(runImport).toHaveBeenCalledTimes(1);
  });

  it('reports duplicate SKUs across differently named products', async () => {
    parser.parse.mockResolvedValue({
      rows: [
        { ...row, sku: 'SKU' },
        { ...row, slug: 'other-box', sku: 'SKU' },
      ],
      images: new Map(),
    });
    expect(await service.validate(file)).toMatchObject({
      valid: false,
      errors: [{ row: 3, field: 'sku' }],
    });
  });

  it.each(['0', '-1', '1.5', 'NaN', 'Infinity'])(
    'rejects invalid MOQ %s before writes',
    async (moq) => {
      parser.parse.mockResolvedValue({
        rows: [{ ...row, moq }],
        images: new Map(),
      });
      expect(await service.validate(file)).toMatchObject({
        valid: false,
        errors: [{ field: 'moq' }],
      });
      expect(products.create).not.toHaveBeenCalled();
    },
  );

  it('maps the complete product contract during bulk import', async () => {
    parser.parse.mockResolvedValue({
      rows: [
        {
          ...row,
          images: 'front.jpg|side.jpg',
          imageAlts: 'Front view|Side view',
          length: '30',
          width: '20',
          height: '10',
          weight: '0.5',
          dimensionUnit: 'cm',
          customizableProperties: '{"printSides":["outside","inside"]}',
          seoTitle: 'Mailer box',
          seoDescription: 'Custom mailer box',
          canonicalUrl: 'https://example.com/products/mailer-box',
        },
      ],
      images: new Map(),
    });

    await service.runImport('import-id');

    expect(products.createManyAtomic).toHaveBeenCalledWith([
      expect.objectContaining({
        dimensions: {
          length: 30,
          width: 20,
          height: 10,
          weight: 0.5,
          unit: 'cm',
        },
        customizableProperties: { printSides: ['outside', 'inside'] },
        seo: {
          title: 'Mailer box',
          description: 'Custom mailer box',
          canonicalUrl: 'https://example.com/products/mailer-box',
        },
        images: [
          expect.objectContaining({ key: 'front.jpg', alt: 'Front view' }),
          expect.objectContaining({ key: 'side.jpg', alt: 'Side view' }),
        ],
      }),
    ]);
  });

  it.each([
    ['status', 'live'],
    ['visibility', 'members-only'],
    ['featured', 'yes'],
    ['length', '-1'],
    ['dimensionUnit', 'metres'],
    ['customizableProperties', '[]'],
    ['canonicalUrl', 'ftp://example.com/product'],
  ])('rejects invalid bulk field %s', async (field, value) => {
    parser.parse.mockResolvedValue({
      rows: [{ ...row, [field]: value }],
      images: new Map(),
    });

    expect(await service.validate(file)).toMatchObject({
      valid: false,
      errors: [{ field }],
    });
  });

  it('uses an atomic write for all-or-nothing imports', async () => {
    await service.runImport('import-id');
    expect(products.createManyAtomic).toHaveBeenCalledTimes(1);
    expect(products.create).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenLastCalledWith(
      'import-id',
      expect.objectContaining({ status: 'completed', successCount: 1 }),
    );
  });

  it('marks unexpected processing failures as failed instead of leaving them processing', async () => {
    parser.parse.mockRejectedValue(new Error('Parser failed'));
    await expect(service.runImport('import-id')).rejects.toThrow(
      'Parser failed',
    );
    expect(repository.update).toHaveBeenLastCalledWith(
      'import-id',
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('never falls back to individual inserts when an atomic write fails', async () => {
    products.createManyAtomic.mockRejectedValue(
      new Error('Transaction failed'),
    );
    await expect(service.runImport('import-id')).rejects.toThrow(
      'Transaction failed',
    );
    expect(products.create).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenLastCalledWith(
      'import-id',
      expect.objectContaining({ status: 'failed' }),
    );
  });
});
