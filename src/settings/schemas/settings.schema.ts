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

  @Prop({ default: '' })
  logoUrl: string;

  @Prop({ default: 'INR' })
  currency: string;

  // low-stock alert threshold used by the dashboard, per bar
  @Prop({ default: 20 })
  lowStockThreshold: number;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
