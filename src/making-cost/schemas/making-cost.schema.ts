import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CostType } from '../../common/enums';

export type MakingCostDocument = MakingCost & Document;

@Schema({ timestamps: true })
export class MakingCost {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true }) branch: Types.ObjectId;
  @Prop({ required: true })
  date: Date;

  @Prop({ enum: CostType, required: true })
  costType: CostType;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: '' })
  notes: string;
}

export const MakingCostSchema = SchemaFactory.createForClass(MakingCost);
MakingCostSchema.index({ date: 1 });
