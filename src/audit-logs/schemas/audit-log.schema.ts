import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type AuditActorType = 'admin' | 'system';

@Schema({ timestamps: true })
export class AuditLog {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Admin', default: null })
  actorId!: Types.ObjectId | null;

  @Prop({ type: String, enum: ['admin', 'system'], default: 'admin' })
  actorType!: AuditActorType;

  @Prop({ required: true, index: true })
  action!: string;

  @Prop({ required: true, index: true })
  resourceType!: string;

  @Prop({ type: String, default: null })
  resourceId!: string | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  before!: unknown;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  after!: unknown;

  @Prop({ type: String, default: null })
  ip!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  requestId!: string | null;

  createdAt!: Date;
}

export type AuditLogDocument = AuditLog & Document;

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
