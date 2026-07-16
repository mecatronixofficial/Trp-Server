import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
export type DailyClosingDocument = DailyClosing & Document;
@Schema({ timestamps: true })
export class DailyClosing {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true }) branch: Types.ObjectId;
  @Prop({ required: true, index: true }) date: string;
  @Prop({ default: 0 }) openingBalance: number;
  @Prop({ default: 0 }) produced: number;
  @Prop({ default: 0 }) sold: number;
  @Prop({ default: 0 }) returned: number;
  @Prop({ default: 0 }) wastage: number;
  @Prop({ default: 0 }) closingBalance: number;
  @Prop({ default: 0 }) sellingAmount: number;
  @Prop({ default: 0 }) makingCost: number;
  @Prop({ default: 0 }) profit: number;
  @Prop({ enum: ['open', 'closed'], default: 'open' }) status: 'open' | 'closed';
  @Prop({ default: null }) closedAt: Date | null;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) closedBy: Types.ObjectId | null;
  @Prop({ default: null }) alertSentAt: Date | null;
}
export const DailyClosingSchema = SchemaFactory.createForClass(DailyClosing);
DailyClosingSchema.index({ branch: 1, date: 1 }, { unique: true });
