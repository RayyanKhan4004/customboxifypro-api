import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoleStatus = 'active' | 'inactive';

@Schema({ timestamps: true })
export class Role {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true })
  key!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: [String], default: [] })
  permissions!: string[];

  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status!: RoleStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type RoleDocument = Role & Document;
export const RoleSchema = SchemaFactory.createForClass(Role);
