import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

import { applySoftDelete } from '../../database/plugins/soft-delete.plugin';

export const REQUEST_TYPES = [
  'custom-quote',
  'pricing',
  'bulk-order',
  'sampling',
  'other',
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = [
  'new',
  'in-review',
  'quoted',
  'approved',
  'rejected',
  'cancelled',
  'won',
  'lost',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface RequestContact {
  name: string;
  email: string;
  phone?: string;
  company?: string;
}

export interface RequestNote {
  text: string;
  adminId?: string;
  createdAt: Date;
}

@Schema({ timestamps: true })
export class CustomerRequest {
  _id!: Types.ObjectId;

  @Prop({ type: String, enum: REQUEST_TYPES, required: true })
  requestType!: RequestType;

  @Prop({ type: String, default: null })
  customRequestType!: string | null;

  @Prop({
    type: { name: String, email: String, phone: String, company: String },
    required: true,
  })
  contact!: RequestContact;

  @Prop({ type: String, default: null })
  productName!: string | null;

  @Prop({ type: Number, default: null })
  quantity!: number | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  specs!: Record<string, unknown>;

  @Prop({ type: String, default: null })
  notes!: string | null;

  /** Media object keys (from the public media presign flow). */
  @Prop({ type: [String], default: [] })
  attachments!: string[];

  @Prop({ type: String, enum: REQUEST_STATUSES, default: 'new' })
  status!: RequestStatus;

  @Prop({ type: Types.ObjectId, ref: 'Admin', default: null })
  assignedTo!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  assignedAt!: Date | null;

  @Prop({ required: true, unique: true })
  idempotencyKey!: string;

  @Prop({ type: Boolean, required: true })
  consent!: boolean;

  /** SHA-256 of the submitter IP (privacy: never store raw IPs). */
  @Prop({ type: String, default: null })
  sourceIpHash!: string | null;

  @Prop({
    type: [{ text: String, adminId: String, createdAt: Date }],
    default: [],
  })
  staffNotes!: RequestNote[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type CustomerRequestDocument = CustomerRequest & Document;

export const CustomerRequestSchema =
  SchemaFactory.createForClass(CustomerRequest);
applySoftDelete(CustomerRequestSchema);

CustomerRequestSchema.index({ status: 1, createdAt: -1 });
CustomerRequestSchema.index({ requestType: 1, status: 1 });
CustomerRequestSchema.index({ assignedTo: 1, status: 1 });
CustomerRequestSchema.index({ 'contact.email': 1, createdAt: -1 });
