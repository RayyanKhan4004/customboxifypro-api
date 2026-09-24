import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation {
  _id!: Types.ObjectId;
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  })
  customerId!: Types.ObjectId;
  @Prop({ required: true }) phoneNumberId!: string;
  @Prop({ required: true }) waId!: string;
  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  quoteIds!: Types.ObjectId[];
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Admin', default: null })
  assignedTo!: Types.ObjectId | null;
  @Prop({ enum: ['open', 'resolved'], default: 'open' }) status!:
    'open' | 'resolved';
  @Prop({ type: Date, default: null }) lastInboundAt!: Date | null;
  @Prop({ type: Date, default: null }) lastMessageAt!: Date | null;
  @Prop({ type: String, default: '' }) lastMessagePreview!: string;
  @Prop({ type: Number, default: 0 }) unreadCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export type ConversationDocument = Conversation & Document;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ phoneNumberId: 1, waId: 1 }, { unique: true });
ConversationSchema.index({ assignedTo: 1, lastMessageAt: -1 });
ConversationSchema.index({ customerId: 1 });
