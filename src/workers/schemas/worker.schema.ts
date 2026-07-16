import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WorkerDocument = Worker & Document;

@Schema({ timestamps: true })
export class Worker {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Truck', unique: true, sparse: true })
  truck?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '', trim: true })
  phoneNumber: string;

  @Prop({ default: '', trim: true })
  role: string;

  @Prop({ default: 0 })
  monthlySalary: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: '' })
  notes: string;
}

export const WorkerSchema = SchemaFactory.createForClass(Worker);
WorkerSchema.index({ name: 1 });
