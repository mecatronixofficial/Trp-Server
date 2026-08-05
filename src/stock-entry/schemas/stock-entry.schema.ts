import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StockEntryDocument = StockEntry & Document;

// A manual bar-stock deduction, independent of the box-counter production log.
// Final Total Bars = Production totalBars - sum(StockEntry.quantity).
@Schema({ timestamps: true })
export class StockEntry {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true }) branch: Types.ObjectId;
  @Prop({ required: true })
  date: Date;

  // supports quarter-bar increments: 0.25, 0.5, 0.75, 1, 1.25, ...
  @Prop({ required: true, min: 0.25 })
  quantity: number;

  @Prop({ default: '' })
  notes: string;
}

export const StockEntrySchema = SchemaFactory.createForClass(StockEntry);
StockEntrySchema.index({ date: 1 });
