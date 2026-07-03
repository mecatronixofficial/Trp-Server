import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IceBarSize, PaymentMode, SaleType } from '../../common/enums';

export type SaleDocument = Sale & Document;

@Schema({ _id: false })
export class SaleItem {
  @Prop({ enum: IceBarSize, required: true })
  size: IceBarSize;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  pricePerBar: number;

  // quantity * pricePerBar, computed server-side
  @Prop({ required: true, min: 0 })
  total: number;
}
export const SaleItemSchema = SchemaFactory.createForClass(SaleItem);

@Schema({ _id: false })
export class SalePayment {
  @Prop({ required: true })
  date: Date;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ enum: PaymentMode, required: true })
  paymentMode: PaymentMode;

  @Prop({ default: '' })
  notes: string;
}
export const SalePaymentSchema = SchemaFactory.createForClass(SalePayment);

@Schema({ timestamps: true })
export class Sale {
  @Prop({ required: true })
  date: Date;

  @Prop({ type: Types.ObjectId, ref: 'Truck', required: true })
  truck: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customer: Types.ObjectId;

  @Prop({ enum: SaleType, required: true })
  saleType: SaleType;

  @Prop({ type: [SaleItemSchema], required: true })
  items: SaleItem[];

  // sum of items[].total
  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ enum: PaymentMode, required: true })
  paymentMode: PaymentMode;

  @Prop({ required: true, min: 0, default: 0 })
  paidAmount: number;

  // totalAmount - paidAmount
  @Prop({ required: true, default: 0 })
  balanceAmount: number;

  @Prop({ type: [SalePaymentSchema], default: [] })
  payments: SalePayment[];

  @Prop({ default: '' })
  notes: string;

  // set true when admin edits an entry after creation, for audit visibility
  @Prop({ default: false })
  edited: boolean;
}

export const SaleSchema = SchemaFactory.createForClass(Sale);
SaleSchema.index({ date: 1 });
SaleSchema.index({ truck: 1, date: 1 });
SaleSchema.index({ customer: 1 });
