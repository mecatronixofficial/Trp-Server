import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SaleType } from '../../common/enums';

export type CustomerDocument = Customer & Document;

@Schema({ timestamps: true })
export class Customer {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  phoneNumber: string;

  @Prop({ trim: true })
  address: string;

  @Prop({ enum: SaleType, default: SaleType.RETAIL })
  defaultSaleType: SaleType;

  @Prop({ default: 0 })
  creditBalance: number; // running balance owed by this customer

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: '' })
  notes: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
