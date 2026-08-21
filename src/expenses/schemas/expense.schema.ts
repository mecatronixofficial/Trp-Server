import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExpenseDocument = Expense & Document;

// General admin-entered business expenses (electricity, labour, snacks, worker
// advances, truck fuel, etc.) — distinct from MakingCost (production overhead)
// and DriverExpense (a driver's own on-trip expense log).
@Schema({ timestamps: true })
export class Expense {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true }) branch: Types.ObjectId;

  @Prop({ required: true, index: true })
  date: Date;

  @Prop({ required: true })
  costType: string;

  @Prop({ required: true, min: 0.01 })
  amount: number;

  @Prop({ default: '' })
  notes: string;

  @Prop({ type: Types.ObjectId, ref: 'Worker' })
  worker?: Types.ObjectId;

  @Prop({ default: '' })
  workerName?: string;

  @Prop({ type: Types.ObjectId, ref: 'Truck' })
  truck?: Types.ObjectId;

  @Prop({ default: '' })
  truckName?: string;

  @Prop({ default: 0 })
  fuelQuantity?: number;

  @Prop({ default: '' })
  description?: string;

  @Prop({ default: 'ADMIN', enum: ['ADMIN', 'DRIVER'], index: true })
  createdByType: 'ADMIN' | 'DRIVER';

  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId;

  @Prop({ default: '' })
  driverName?: string;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
ExpenseSchema.index({ date: 1 });
