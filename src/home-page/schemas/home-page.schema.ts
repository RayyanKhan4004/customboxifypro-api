import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class HomePage {
  @Prop({ required: true, unique: true, default: 'home' })
  key!: string;

  @Prop({ enum: ['home', 'countdown'], default: 'home' })
  pageMode!: 'home' | 'countdown';

  @Prop()
  countdownTargetDate?: string;

  @Prop({ required: true })
  eyebrow!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  titleAccent!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  primaryCtaLabel!: string;

  @Prop({ required: true })
  primaryCtaHref!: string;

  @Prop({ required: true })
  secondaryCtaLabel!: string;

  @Prop({ required: true })
  secondaryCtaHref!: string;

  @Prop({ required: true })
  customersValue!: string;

  @Prop({ required: true })
  satisfactionValue!: string;
}

export type HomePageDocument = HomePage & Document;
export const HomePageSchema = SchemaFactory.createForClass(HomePage);
