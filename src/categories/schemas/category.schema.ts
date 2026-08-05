import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { applySoftDelete } from '../../database/plugins/soft-delete.plugin';

@Schema({ timestamps: true })
export class Category {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  parentId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  imageKey!: string | null;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({
    type: { title: String, description: String },
    default: { title: '', description: '' },
  })
  seo!: { title: string; description: string };

  createdAt!: Date;
  updatedAt!: Date;
}

export type CategoryDocument = Category & Document;

export const CategorySchema = SchemaFactory.createForClass(Category);
applySoftDelete(CategorySchema);

CategorySchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
CategorySchema.index({ parentId: 1, sortOrder: 1 });
CategorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });
