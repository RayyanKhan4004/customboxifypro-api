import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class NotificationOutbox {
  _id!: Types.ObjectId;
  @Prop({ required: true, unique: true }) idempotencyKey!: string;
  @Prop({ required: true, enum: ['email', 'whatsapp'] }) channel!:
    'email' | 'whatsapp';
  @Prop({ required: true }) recipient!: string;
  @Prop({ type: Object, required: true }) payload!: Record<string, unknown>;
  @Prop({
    required: true,
    enum: ['pending', 'processing', 'sent', 'failed', 'uncertain', 'blocked'],
    default: 'pending',
  })
  status!:
    'pending' | 'processing' | 'sent' | 'failed' | 'uncertain' | 'blocked';
  @Prop({ default: 0 }) attempts!: number;
  @Prop({ type: Date, default: Date.now }) nextAttemptAt!: Date;
  @Prop({ type: Date, default: null }) leaseUntil!: Date | null;
  @Prop({ type: String, default: null }) providerReference!: string | null;
  @Prop({ type: String, default: null }) failure!: string | null;
}

export type NotificationOutboxDocument = NotificationOutbox & Document;
export const NotificationOutboxSchema =
  SchemaFactory.createForClass(NotificationOutbox);
NotificationOutboxSchema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
