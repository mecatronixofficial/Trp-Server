import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IceBarSize, WastageReason } from '../../common/enums';

export type WastageDocument = Wastage & Document;

@Schema({ timestamps: true })
export class Wastage {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true }) branch: Types.ObjectId;
  @Prop({ required: true })
  date: Date;

  // wastage can happen at the factory (no truck) or on a truck
  @Prop({ type: Types.ObjectId, ref: 'Truck', default: null })
  truck: Types.ObjectId | null;

  @Prop({ enum: IceBarSize, required: true })
  size: IceBarSize;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ enum: WastageReason, required: true })
  reason: WastageReason;

  @Prop({ default: '' })
  notes: string;
}

export const WastageSchema = SchemaFactory.createForClass(Wastage);
WastageSchema.index({ date: 1 });
WastageSchema.index({ truck: 1 });
