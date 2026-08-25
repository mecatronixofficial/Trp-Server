import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Worker } from './worker.schema';

export type WorkerBuyingDocument = WorkerBuying & Document;

// Keep the historical collection name so removing attendance does not erase
// existing worker amount records.
@Schema({ timestamps: true, collection: 'workerattendances' })
export class WorkerBuying {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Worker.name, required: true })
  worker: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ default: 0 })
  buyingAmount: number;

  @Prop({ default: '' })
  notes: string;
}

export const WorkerBuyingSchema = SchemaFactory.createForClass(WorkerBuying);
WorkerBuyingSchema.index({ worker: 1, date: 1 }, { unique: true });
WorkerBuyingSchema.index({ date: 1 });
