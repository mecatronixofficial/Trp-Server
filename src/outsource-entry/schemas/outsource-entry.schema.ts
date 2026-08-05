import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OutsourceEntryDocument = OutsourceEntry & Document;

// Bars brought in from an outside source rather than made in-house.
// Total Bars = Production totalBars + sum(OutsourceEntry.quantity) - sum(StockEntry.quantity).
@Schema({ timestamps: true })
export class OutsourceEntry {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true }) branch: Types.ObjectId;
  @Prop({ required: true })
  date: Date;

  // supports quarter-bar increments: 0.25, 0.5, 0.75, 1, 1.25, ...
  @Prop({ required: true, min: 0.25 })
  quantity: number;

  @Prop({ default: '' })
  notes: string;
}

export const OutsourceEntrySchema = SchemaFactory.createForClass(OutsourceEntry);
OutsourceEntrySchema.index({ date: 1 });
