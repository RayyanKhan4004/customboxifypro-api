import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChatMessage {
  _id!: Types.ObjectId;
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  })
  conversationId!: Types.ObjectId;
  @Prop({ type: String, default: null }) providerMessageId!: string | null;
  @Prop({ type: String, default: null }) idempotencyKey!: string | null;
  @Prop({ enum: ['inbound', 'outbound', 'note'], required: true }) direction!:
    'inbound' | 'outbound' | 'note';
  @Prop({ type: String, default: null }) senderId!: string | null;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Admin', default: null })
  agentId!: Types.ObjectId | null;
  @Prop({
    enum: ['text', 'image', 'document', 'audio', 'video', 'other'],
    default: 'text',
  })
  type!: string;
  @Prop({ type: String, default: '' }) text!: string;
  @Prop({ type: Object, default: null }) attachment!: Record<
    string,
    unknown
  > | null;
  @Prop({
    enum: [
      'received',
      'queued',
      'sending',
      'sent',
      'delivered',
      'read',
      'failed',
      'uncertain',
      'blocked',
    ],
    required: true,
  })
  status!: string;
  @Prop({ type: String, default: null }) failure!: string | null;
  @Prop({ type: Date, default: null }) providerAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export type ChatMessageDocument = ChatMessage & Document;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index(
  { providerMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerMessageId: { $type: 'string' } },
  },
);
ChatMessageSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);
ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });
