import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { applySoftDelete } from '../../database/plugins/soft-delete.plugin';

export type FilterDataType =
  'string' | 'number' | 'boolean' | 'enum' | 'multiselect';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterValidation {
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
}

@Schema({ timestamps: true })
export class FilterDefinition {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  key!: string;

  @Prop({ required: true, trim: true })
  label!: string;

  @Prop({
    type: String,
    enum: ['string', 'number', 'boolean', 'enum', 'multiselect'],
    default: 'string',
  })
  dataType!: FilterDataType;

  /** 'all' or a list of category IDs the filter applies to. */
  @Prop({ type: [String], default: ['all'] })
  categoryScope!: string[];

  @Prop({
    type: [{ value: String, label: String }],
    default: [],
  })
  options!: FilterOption[];

  @Prop({ type: Boolean, default: true })
  searchable!: boolean;

  @Prop({ type: Boolean, default: true })
  filterable!: boolean;

  @Prop({ type: Boolean, default: false })
  sortable!: boolean;

  @Prop({ type: Boolean, default: false })
  required!: boolean;

  @Prop({ type: Boolean, default: false })
  multiple!: boolean;

  @Prop({ default: 0 })
  displayOrder!: number;

  @Prop({
    type: { min: Number, max: Number, pattern: String, required: Boolean },
    default: {},
  })
  validation!: FilterValidation;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export type FilterDefinitionDocument = FilterDefinition & Document;

export const FilterDefinitionSchema =
  SchemaFactory.createForClass(FilterDefinition);
applySoftDelete(FilterDefinitionSchema);
FilterDefinitionSchema.index({ isActive: 1, displayOrder: 1 });
