import { JobsConfig } from '../config/jobs.config';
import { ImportParserService } from './import-parser.service';

describe('ImportParserService file validation', () => {
  const parser = new ImportParserService({
    bulkImportMaxFileSizeBytes: 100,
    bulkImportMaxRows: 5,
  } as JobsConfig);

  it('rejects empty files', async () => {
    await expect(parser.parse(Buffer.alloc(0), 'products.csv')).rejects.toThrow(
      'non-empty',
    );
  });

  it('rejects oversized files before parsing', async () => {
    await expect(
      parser.parse(Buffer.alloc(101), 'products.csv'),
    ).rejects.toThrow('size limit');
  });

  it('rejects header-only CSVs', async () => {
    await expect(
      parser.parse(Buffer.from('name,category\n'), 'products.csv'),
    ).rejects.toThrow('no product rows');
  });

  it('parses a valid product file', async () => {
    expect(
      await parser.parse(
        Buffer.from('name,category\nMailer box,boxes'),
        'products.csv',
      ),
    ).toMatchObject({ rows: [{ name: 'Mailer box', category: 'boxes' }] });
  });
});
