import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class InAppNotification {
  _id!: Types.ObjectId;
  @Prop({ required: true, unique: true }) eventKey!: string;
  @Prop({ type: Types.ObjectId, ref: 'Admin', default: null })
  recipientId!: Types.ObjectId | null;
  @Prop({ required: true }) type!: 'quote' | 'message';
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) href!: string;
  @Prop({ type: [Types.ObjectId], default: [] }) readBy!: Types.ObjectId[];
  createdAt!: Date;
}

export type InAppNotificationDocument = InAppNotification & Document;
export const InAppNotificationSchema =
  SchemaFactory.createForClass(InAppNotification);
InAppNotificationSchema.index({ recipientId: 1, createdAt: -1 });
