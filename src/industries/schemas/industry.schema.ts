import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { applySoftDelete } from '../../database/plugins/soft-delete.plugin';

@Schema({ timestamps: true })
export class Industry {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ default: '' })
  bestFor!: string;

  @Prop({ type: [String], default: [] })
  specifications!: string[];

  @Prop({ type: String, default: null })
  imageKey!: string | null;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export type IndustryDocument = Industry & Document;

export const IndustrySchema = SchemaFactory.createForClass(Industry);
applySoftDelete(IndustrySchema);

IndustrySchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
IndustrySchema.index({ isActive: 1, sortOrder: 1, name: 1 });
