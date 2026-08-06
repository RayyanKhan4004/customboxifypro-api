import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Session {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Admin', required: true, index: true })
  adminId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  familyId!: string;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ type: String })
  prevHash?: string;

  @Prop({ type: String, default: null })
  device!: string | null;

  @Prop({ type: String, default: null })
  ip!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: Date, default: null })
  lastUsedAt!: Date | null;

  @Prop({ required: true, index: true, expires: 0 })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: Date, default: null })
  reusedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type SessionDocument = Session & Document;

export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index(
  { prevHash: 1 },
  {
    unique: true,
    partialFilterExpression: { prevHash: { $type: 'string' } },
  },
);
SessionSchema.index({ adminId: 1, revokedAt: 1 });
