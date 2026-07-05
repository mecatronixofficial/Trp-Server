import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WorkerDocument = Worker & Document;

@Schema({ timestamps: true })
export class Worker {
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
