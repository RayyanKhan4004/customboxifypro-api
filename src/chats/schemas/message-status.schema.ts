import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class MessageStatusEvent {
  _id!: Types.ObjectId;
  @Prop({ required: true, unique: true }) providerMessageId!: string;
  @Prop({ required: true }) status!: 'sent' | 'delivered' | 'read' | 'failed';
  @Prop({ required: true }) rank!: number;
  @Prop({ required: true }) providerAt!: Date;
}

export type MessageStatusEventDocument = MessageStatusEvent & Document;
export const MessageStatusEventSchema =
  SchemaFactory.createForClass(MessageStatusEvent);
MessageStatusEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 },
);
