import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SaleType } from '../../common/enums';

export type PriceListDocument = PriceListEntry & Document;

// One document per (customer, saleType) combination — the flat price for a single bar.
@Schema({ timestamps: true })
export class PriceListEntry {
  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customer: Types.ObjectId;

  @Prop({ enum: SaleType, required: true })
  saleType: SaleType;

  @Prop({ required: true })
  price: number;
}

export const PriceListSchema = SchemaFactory.createForClass(PriceListEntry);
PriceListSchema.index({ customer: 1, saleType: 1 }, { unique: true });
