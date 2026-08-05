import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

import { applySoftDelete } from '../../database/plugins/soft-delete.plugin';

export type ProductStatus = 'draft' | 'published' | 'archived';
export type ProductVisibility = 'public' | 'internal' | 'hidden';

export interface ProductFacet {
  key: string;
  value: string | number | boolean;
}

export interface ProductImage {
  key: string;
  alt: string;
  order: number;
  isMain: boolean;
}

export interface ProductDimensions {
  length?: number;
  width?: number;
  height?: number;
  weight?: number;
  unit?: string;
}

export interface ProductSeo {
  title?: string;
  description?: string;
  canonicalUrl?: string;
}

@Schema({ timestamps: true })
export class Product {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ default: '', trim: true })
  shortDescription!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null, index: true })
  subcategoryId!: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  })
  status!: ProductStatus;

  @Prop({
    type: String,
    enum: ['public', 'internal', 'hidden'],
    default: 'public',
  })
  visibility!: ProductVisibility;

  @Prop({ type: Boolean, default: false })
  featured!: boolean;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: String, default: null })
  sku!: string | null;

  @Prop({
    type: [{ key: String, alt: String, order: Number, isMain: Boolean }],
    default: [],
  })
  images!: ProductImage[];

  @Prop({ type: Map, of: MongooseSchema.Types.Mixed, default: {} })
  attributes!: Map<string, unknown>;

  /** Denormalized filterable attributes (key/value pairs) for indexed filtering. */
  @Prop({
    type: [{ key: String, value: MongooseSchema.Types.Mixed }],
    default: [],
  })
  facets!: ProductFacet[];

  @Prop({
    type: {
      length: Number,
      width: Number,
      height: Number,
      weight: Number,
      unit: String,
    },
    default: { unit: 'cm' },
  })
  dimensions!: ProductDimensions;

  @Prop({ type: Number, default: null })
  moq!: number | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  customizableProperties!: unknown;

  @Prop({
    type: { title: String, description: String, canonicalUrl: String },
    default: {},
  })
  seo!: ProductSeo;

  @Prop({ type: Types.ObjectId, ref: 'Admin', default: null })
  createdBy!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Admin', default: null })
  updatedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null;

  @Prop({ type: Number, default: 1 })
  version!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ProductDocument = Product & Document;

export const ProductSchema = SchemaFactory.createForClass(Product);
applySoftDelete(ProductSchema);

ProductSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
ProductSchema.index(
  { sku: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
ProductSchema.index({ status: 1, visibility: 1, publishedAt: -1, _id: -1 });
ProductSchema.index({ status: 1, visibility: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ status: 1, visibility: 1, name: 1, _id: 1 });
ProductSchema.index({ status: 1, visibility: 1, updatedAt: -1, _id: -1 });
ProductSchema.index({
  status: 1,
  visibility: 1,
  categoryId: 1,
  publishedAt: -1,
  _id: -1,
});
ProductSchema.index({ 'facets.key': 1, 'facets.value': 1 });
ProductSchema.index({
  status: 1,
  visibility: 1,
  categoryId: 1,
  'facets.key': 1,
  'facets.value': 1,
  publishedAt: -1,
});
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
