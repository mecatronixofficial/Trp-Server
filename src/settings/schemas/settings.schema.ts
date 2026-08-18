import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingsDocument = Settings & Document;

@Schema({ timestamps: true })
export class Settings {
  @Prop({ default: 'Tiruppur Ice Since 2000' })
  businessName: string;

  @Prop({ default: '' })
  address: string;

  @Prop({ default: '' })
  phoneNumber: string;

  @Prop({ default: '' })
  whatsappNumber: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  gstNumber: string;

  // Data-URI logo uploaded from the settings page. Named to match what the
  // frontend actually reads/writes — it previously sent `businessLogo` while
  // this field was called `logoUrl`, so Mongoose's default strict mode
  // silently dropped every uploaded logo before it ever reached the DB.
  @Prop({ default: '' })
  businessLogo: string;

  @Prop({ default: 'INR' })
  currency: string;

  // low-stock alert threshold used by the dashboard, per bar
  @Prop({ default: 20 })
  lowStockThreshold: number;

  // total boxes in the mold/box counter cycle before it wraps back to 1
  @Prop({ default: 200 })
  totalBoxes: number;

  // ice bars produced per box
  @Prop({ default: 2 })
  barsPerBox: number;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
