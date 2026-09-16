import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import { applySoftDelete } from '../../database/plugins/soft-delete.plugin';

@Schema({ timestamps: true })
export class PackagingStyle {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: String, default: null })
  imageKey!: string | null;

  @Prop({ type: Number, default: null })
  minimumOrderQuantity!: number | null;

  @Prop({ default: 'Delivery 2 weeks' })
  deliveryTime!: string;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;
}

export type PackagingStyleDocument = PackagingStyle & Document;

export const PackagingStyleSchema =
  SchemaFactory.createForClass(PackagingStyle);
applySoftDelete(PackagingStyleSchema);
PackagingStyleSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
PackagingStyleSchema.index({ isActive: 1, sortOrder: 1, name: 1 });
