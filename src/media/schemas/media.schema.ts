import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { applySoftDelete } from '../../database/plugins/soft-delete.plugin';

export type MediaStatus = 'pending' | 'processing' | 'ready' | 'failed';

@Schema({ timestamps: true })
export class Media {
  _id!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  uploadId!: string;

  @Prop({ required: true })
  originalName!: string;

  @Prop({ required: true })
  mimeType!: string;

  @Prop({ required: true })
  sizeBytes!: number;

  @Prop({ type: Number, default: null })
  width!: number | null;

  @Prop({ type: Number, default: null })
  height!: number | null;

  @Prop({
    type: String,
    enum: ['pending', 'processing', 'ready', 'failed'],
    default: 'pending',
  })
  status!: MediaStatus;

  @Prop({ default: '' })
  alt!: string;

  @Prop({ type: Number, default: 0 })
  order!: number;

  @Prop({ type: Boolean, default: false })
  isMain!: boolean;

  /** Variant name -> object key (e.g. thumbnail -> variants/.../thumb-xxx.webp). */
  @Prop({ type: Object, default: {} })
  variants!: Record<string, string>;

  @Prop({ type: Types.ObjectId, ref: 'Admin', default: null })
  createdBy!: Types.ObjectId | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MediaDocument = Media & Document;

export const MediaSchema = SchemaFactory.createForClass(Media);
applySoftDelete(MediaSchema);

MediaSchema.index({ createdAt: -1 });
MediaSchema.index({ isMain: 1, status: 1 });
