import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { applySoftDelete } from '../../database/plugins/soft-delete.plugin';

export type ImportStatus =
  'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type ImportMode = 'draft' | 'all-or-nothing';

export interface ImportRowError {
  row?: number;
  field?: string;
  code: string;
  message: string;
}

@Schema({ timestamps: true })
export class BulkImport {
  _id!: Types.ObjectId;

  @Prop({ required: true })
  fileName!: string;

  @Prop({ required: true })
  fileKey!: string;

  @Prop({
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'queued',
  })
  status!: ImportStatus;

  @Prop({ type: String, enum: ['draft', 'all-or-nothing'], default: 'draft' })
  mode!: ImportMode;

  @Prop({ type: Number, default: 0 })
  totalRows!: number;

  @Prop({ type: Number, default: 0 })
  processedRows!: number;

  @Prop({ type: Number, default: 0 })
  successCount!: number;

  @Prop({ type: Number, default: 0 })
  errorCount!: number;

  /** Capped set of row errors for quick review. Full list via error-file export. */
  @Prop({
    type: [{ row: Number, field: String, code: String, message: String }],
    default: [],
  })
  rowErrors!: ImportRowError[];

  @Prop({ type: Types.ObjectId, ref: 'Admin', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type BulkImportDocument = BulkImport & Document;

export const BulkImportSchema = SchemaFactory.createForClass(BulkImport);
applySoftDelete(BulkImportSchema);

BulkImportSchema.index({ createdAt: -1 });
BulkImportSchema.index({ status: 1, createdAt: -1 });
