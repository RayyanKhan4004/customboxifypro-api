import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { BulkImportService } from './bulk-import.service';

describe('BulkImportService regressions', () => {
  let service: BulkImportService;
  const parser = { parse: jest.fn() };
  const repository = { findById: jest.fn(), update: jest.fn() };
  const products = { create: jest.fn(), createManyAtomic: jest.fn() };
  const storage = { getObject: jest.fn(), putObject: jest.fn() };
  const cache = { exists: jest.fn() };
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
      JobsConfig: { bulkImportBatchSize: 10 },
      AppLogger: { info: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [BulkImportService],
    })
      .useMocker((token) =>
        typeof token === 'function' ? (mocks[token.name] ?? {}) : {},
      )
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
