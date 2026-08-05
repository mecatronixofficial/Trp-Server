import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TruckAssignmentDocument = TruckAssignment & Document;

@Schema({ timestamps: true })
export class TruckAssignment {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Truck', required: true, index: true })
  truck: Types.ObjectId;

  @Prop({ required: true, index: true })
  date: Date;

  @Prop({ required: true, min: 0 })
  quantity: number;

  @Prop({ default: '' })
  notes: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assignedBy: Types.ObjectId | null;
}

export const TruckAssignmentSchema = SchemaFactory.createForClass(TruckAssignment);
TruckAssignmentSchema.index({ truck: 1, date: 1 }, { unique: true });
