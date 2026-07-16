import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IceBarSize, Shift } from '../../common/enums';

export type ProductionDocument = Production & Document;

@Schema({ _id: false })
export class SizeQuantity {
  @Prop({ enum: IceBarSize, required: true })
  size: IceBarSize;

  @Prop({ required: true, default: 0 })
  quantity: number;
}
export const SizeQuantitySchema = SchemaFactory.createForClass(SizeQuantity);

@Schema({ timestamps: true })
export class Production {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true }) branch: Types.ObjectId;
  @Prop({ required: true })
  date: Date;

  @Prop({ enum: Shift, default: Shift.FULL_DAY })
  shift: Shift;

  @Prop({ type: [SizeQuantitySchema], default: [] })
  sizeWise: SizeQuantity[];

  @Prop({ required: true, default: 0 })
  totalBars: number;

  @Prop({ default: '' })
  notes: string;
}

export const ProductionSchema = SchemaFactory.createForClass(Production);
ProductionSchema.index({ date: 1 });
