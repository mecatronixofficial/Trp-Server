import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IceBarSize, SaleType } from '../../common/enums';

export type PriceListDocument = PriceListEntry & Document;

// One document per (customer, size, saleType) combination.
@Schema({ timestamps: true })
export class PriceListEntry {
  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customer: Types.ObjectId;

  @Prop({ enum: IceBarSize, required: true })
  size: IceBarSize;

  @Prop({ enum: SaleType, required: true })
  saleType: SaleType;

  @Prop({ required: true })
  price: number;
}

export const PriceListSchema = SchemaFactory.createForClass(PriceListEntry);
PriceListSchema.index({ customer: 1, size: 1, saleType: 1 }, { unique: true });
