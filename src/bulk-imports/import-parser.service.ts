import { Injectable } from '@nestjs/common';
import AdmZip from 'adm-zip';
import * as XLSX from 'xlsx';
import { parseString } from 'fast-csv';

import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
import { JobsConfig } from '../config/jobs.config';

export interface ParsedImport {
  rows: Array<Record<string, string>>;
  /** filename -> Buffer for image entries extracted from a ZIP archive. */
  images: Map<string, Buffer>;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const DATA_EXTENSIONS = new Set(['csv', 'xlsx', 'xls']);

@Injectable()
export class ImportParserService {
  constructor(private readonly jobsConfig: JobsConfig) {}

  async parse(buffer: Buffer, fileName: string): Promise<ParsedImport> {
    const extension = this.extensionOf(fileName);
    if (extension === 'zip') {
      return this.parseZip(buffer);
    }
    if (extension === 'csv') {
      return {
        rows: this.sanitizeRows(await this.parseCsv(buffer)),
        images: new Map(),
      };
    }
    if (extension === 'xlsx' || extension === 'xls') {
      return {
        rows: this.sanitizeRows(this.parseXlsx(buffer)),
        images: new Map(),
      };
    }
    throw ApiException.invalid(
      ErrorCodes.IMPORT_INVALID_FILE,
      'Unsupported file type. Upload a .csv, .xlsx, or .zip file.',
      [{ field: 'file' }],
    );
  }

  private async parseZip(buffer: Buffer): Promise<ParsedImport> {
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      throw ApiException.invalid(
        ErrorCodes.IMPORT_INVALID_FILE,
        'The uploaded file is not a valid ZIP archive.',
        [{ field: 'file' }],
      );
    }

    const entries = zip.getEntries();
    const cfg = this.jobsConfig;

    if (entries.length === 0) {
      throw ApiException.invalid(
        ErrorCodes.IMPORT_INVALID_FILE,
        'The ZIP archive is empty.',
        [{ field: 'file' }],
      );
    }
    if (entries.length > cfg.bulkImportZipMaxFiles) {
      throw ApiException.invalid(
        ErrorCodes.IMPORT_ZIP_VIOLATION,
        `The ZIP archive contains more than ${cfg.bulkImportZipMaxFiles} files.`,
        [{ field: 'file' }],
      );
    }

    let totalUncompressed = 0;
    for (const entry of entries) {
      const size = entry.header.size ?? 0;
      const compressedSize = entry.header.compressedSize ?? 0;
      totalUncompressed += size;
      if (
        compressedSize > 0 &&
        size / compressedSize > cfg.bulkImportZipMaxRatio
      ) {
        throw ApiException.invalid(
          ErrorCodes.IMPORT_ZIP_VIOLATION,
          `File "${entry.entryName}" exceeds the allowed compression ratio (possible zip bomb).`,
          [{ field: 'file' }],
        );
      }
    }
    if (totalUncompressed > cfg.bulkImportZipMaxSizeBytes) {
      throw ApiException.invalid(
        ErrorCodes.IMPORT_ZIP_VIOLATION,
        'The extracted ZIP content exceeds the allowed size limit.',
        [{ field: 'file' }],
      );
    }

    const dataEntry = entries.find((entry) =>
      DATA_EXTENSIONS.has(this.extensionOf(entry.entryName)),
    );
    if (!dataEntry || dataEntry.isDirectory) {
      throw ApiException.invalid(
        ErrorCodes.IMPORT_INVALID_FILE,
        'The ZIP archive must contain a .csv or .xlsx data file.',
        [{ field: 'file' }],
      );
    }

    const images = new Map<string, Buffer>();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const ext = this.extensionOf(entry.entryName);
      if (IMAGE_EXTENSIONS.has(ext)) {
        const fileName = entry.entryName.split('/').pop() ?? '';
        if (fileName) images.set(fileName.toLowerCase(), entry.getData());
      }
    }

    const dataBuffer = dataEntry.getData();
    const dataFileName = dataEntry.entryName;
    if (this.extensionOf(dataFileName) === 'csv') {
      return {
        rows: this.sanitizeRows(await this.parseCsv(dataBuffer)),
        images,
      };
    }
    return { rows: this.sanitizeRows(this.parseXlsx(dataBuffer)), images };
  }

  private async parseCsv(
    buffer: Buffer,
  ): Promise<Array<Record<string, string>>> {
    const rows: Array<Record<string, string>> = [];
    await new Promise<void>((resolve, reject) => {
      parseString(buffer.toString('utf8'), {
        headers: true,
        trim: true,
        ignoreEmpty: true,
      })
        .on('error', (error) => {
          reject(
            ApiException.invalid(
              ErrorCodes.IMPORT_INVALID_FILE,
              'The CSV file could not be parsed.',
              [{ field: 'file', message: error.message }],
            ),
          );
        })
        .on('data', (row: Record<string, string>) => rows.push(row))
        .on('end', () => resolve());
    });
    this.assertRowLimit(rows.length);
    return rows;
  }

  private parseXlsx(buffer: Buffer): Array<Record<string, string>> {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch {
      throw ApiException.invalid(
        ErrorCodes.IMPORT_INVALID_FILE,
        'The XLSX file could not be parsed.',
        [{ field: 'file' }],
      );
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      throw ApiException.invalid(
        ErrorCodes.IMPORT_INVALID_FILE,
        'The XLSX file has no data sheet.',
        [{ field: 'file' }],
      );
    }
    const rows = XLSX.utils.sheet_to_json<
      Record<string, string | number | boolean>
    >(sheet, {
      defval: '',
    });
    this.assertRowLimit(rows.length);
    return rows.map((row) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[key.trim()] =
          value === null || value === undefined ? '' : String(value);
      }
      return normalized;
    });
  }

  private sanitizeRows(
    rows: Array<Record<string, string>>,
  ): Array<Record<string, string>> {
    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        row[key] = this.sanitizeCell(value);
      }
    }
    return rows;
  }

  /** CSV formula injection guard: neutralize leading = + - @ and tab/CR. */
  private sanitizeCell(value: string): string {
    if (/^[=+\-@\t\r]/.test(value)) {
      return `'${value}`;
    }
    return value;
  }

  private assertRowLimit(count: number): void {
    if (count > this.jobsConfig.bulkImportMaxRows) {
      throw ApiException.invalid(
        ErrorCodes.IMPORT_TOO_MANY_ROWS,
        `The file contains ${count} rows; the maximum allowed is ${this.jobsConfig.bulkImportMaxRows}.`,
        [{ field: 'file' }],
      );
    }
  }

  private extensionOf(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() ?? '';
  }
}
