import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Customer {
  _id!: Types.ObjectId;
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) email!: string | null;
  @Prop({ type: String, default: null }) phone!: string | null;
  @Prop({ type: Boolean, default: false }) whatsappConsent!: boolean;
  @Prop({ type: Date, default: null }) consentAt!: Date | null;
  @Prop({ type: String, default: null }) consentSource!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export type CustomerDocument = Customer & Document;
export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ phone: 1 });
CustomerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
