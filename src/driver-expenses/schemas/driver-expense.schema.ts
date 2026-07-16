import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
export type DriverExpenseDocument = DriverExpense & Document;
@Schema({ timestamps: true })
export class DriverExpense {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true }) branch: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Truck', required: true, index: true }) truck: Types.ObjectId;
  @Prop({ required: true, index: true }) date: Date;
  @Prop({ required: true, min: 0.01 }) amount: number;
  @Prop({ required: true, trim: true }) purpose: string;
  @Prop({ default: '' }) notes: string;
}
export const DriverExpenseSchema = SchemaFactory.createForClass(DriverExpense);
