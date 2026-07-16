import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Worker } from './worker.schema';

export type WorkerAttendanceDocument = WorkerAttendance & Document;

export enum WorkerAttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  HALF_DAY = 'half_day',
}

@Schema({ timestamps: true })
export class WorkerAttendance {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Worker.name, required: true })
  worker: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ enum: WorkerAttendanceStatus, default: WorkerAttendanceStatus.PRESENT })
  status: WorkerAttendanceStatus;

  @Prop({ default: 0 })
  buyingAmount: number;

  @Prop({ default: '' })
  notes: string;
}

export const WorkerAttendanceSchema = SchemaFactory.createForClass(WorkerAttendance);
WorkerAttendanceSchema.index({ worker: 1, date: 1 }, { unique: true });
WorkerAttendanceSchema.index({ date: 1 });
