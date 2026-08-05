import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { applySoftDelete } from '../../database/plugins/soft-delete.plugin';

export type AdminStatus = 'active' | 'invited' | 'disabled';

@Schema({ timestamps: true })
export class Admin {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: true, index: true })
  roleId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['active', 'invited', 'disabled'],
    default: 'active',
  })
  status!: AdminStatus;

  @Prop({ default: 0 })
  failedLoginAttempts!: number;

  @Prop({ default: null })
  lockoutUntil!: Date | null;

  @Prop({ default: null })
  lastLoginAt!: Date | null;

  @Prop({ default: null })
  lastLoginIp!: string | null;

  @Prop({ default: null })
  passwordChangedAt!: Date | null;

  @Prop({ type: [String], default: [] })
  previousPasswordHashes!: string[];

  @Prop({ type: String, default: null, select: false })
  passwordResetTokenHash!: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpiresAt!: Date | null;

  @Prop({ type: String, default: null, select: false })
  invitationTokenHash!: string | null;

  @Prop({ type: Date, default: null })
  invitationExpiresAt!: Date | null;

  @Prop({ type: Boolean, default: false })
  twoFactorEnabled!: boolean;

  @Prop({ type: String, default: null, select: false })
  twoFactorSecretEncrypted!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type AdminDocument = Admin & Document;

export const AdminSchema = SchemaFactory.createForClass(Admin);
applySoftDelete(AdminSchema);

AdminSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
